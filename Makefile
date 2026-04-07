IMAGE     := scim-dev-server
TAG       := latest
NAMESPACE := scim-dev
K8S       := k8s

# microk8s ships its own kubectl wrapper.
# If you've already exported the kubeconfig (`microk8s config > ~/.kube/config`)
# and are using a standalone kubectl, change this to: KUBECTL := kubectl
KUBECTL   := microk8s kubectl

# ─────────────────────────────────────────────────────────────────────────────
# secrets
#   Reads .env.k8s.local and creates (or updates) the scim-dev-secrets Secret
#   in the cluster.  Fully idempotent — safe to run after any value changes.
#
#   First-time setup:
#     cp k8s/env.template .env.k8s.local
#     <fill in every value>
#     make secrets
#
#   How it works:
#     kubectl create secret --from-env-file   reads KEY=VALUE lines from the file
#     --dry-run=client -o yaml | kubectl apply  makes the operation idempotent
#     (create on first run, patch on subsequent runs)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: secrets
secrets:
	@test -f .env.k8s.local || { \
		echo ""; \
		echo "ERROR: .env.k8s.local not found."; \
		echo "  1.  cp k8s/env.template .env.k8s.local"; \
		echo "  2.  Fill in every value in .env.k8s.local"; \
		echo "  3.  make secrets"; \
		echo ""; \
		exit 1; \
	}
	@if grep -qE '=$$|=YOURPASSWORD' .env.k8s.local; then \
		echo ""; \
		echo "ERROR: .env.k8s.local still has empty or unfilled values."; \
		echo "  Fill in every KEY=value line, then run 'make secrets' again."; \
		echo ""; \
		exit 1; \
	fi
	@echo "Ensuring namespace $(NAMESPACE) exists..."
	@$(KUBECTL) create namespace $(NAMESPACE) --dry-run=client -o yaml | \
		$(KUBECTL) apply -f - > /dev/null
	@echo "Applying secret scim-dev-secrets from .env.k8s.local ..."
	@$(KUBECTL) create secret generic scim-dev-secrets \
		--namespace $(NAMESPACE) \
		--from-env-file=.env.k8s.local \
		--dry-run=client -o yaml | $(KUBECTL) apply -f -
	@echo "Done. Secret 'scim-dev-secrets' is live in namespace '$(NAMESPACE)'."

# ─────────────────────────────────────────────────────────────────────────────
# image-build
#   Builds the Docker image with the local Docker daemon, then imports it
#   directly into microk8s's containerd so Kubernetes can use it without
#   a registry (imagePullPolicy: Never still applies).
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: image-build
image-build:
	docker build -t $(IMAGE):$(TAG) .
	docker save $(IMAGE):$(TAG) | microk8s ctr images import -

# ─────────────────────────────────────────────────────────────────────────────
# deploy
#   1. Ensures the Secret is up-to-date (runs `secrets`)
#   2. Checks the ConfigMap has no unfilled placeholders
#   3. Applies all remaining manifests via kustomize
#   4. Waits for the rollout to complete
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: deploy
deploy: secrets configmap-check
	$(KUBECTL) apply -k $(K8S)/
	# Force a rollout restart so the pod always picks up the newly imported image.
	# Without this, Kubernetes sees imagePullPolicy:Never + unchanged image tag
	# and leaves the running pod untouched even after `make image-build`.
	$(KUBECTL) rollout restart deployment/scim-dev -n $(NAMESPACE)
	$(KUBECTL) rollout status  deployment/scim-dev -n $(NAMESPACE) --timeout=120s

# ─────────────────────────────────────────────────────────────────────────────
# redeploy — rebuild image and restart the deployment
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: redeploy
redeploy: image-build
	$(KUBECTL) rollout restart deployment/scim-dev -n $(NAMESPACE)
	$(KUBECTL) rollout status  deployment/scim-dev -n $(NAMESPACE) --timeout=120s

# ─────────────────────────────────────────────────────────────────────────────
# undeploy — remove all cluster resources (keeps the image in containerd)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: undeploy
undeploy:
	$(KUBECTL) delete -k $(K8S)/ --ignore-not-found
	$(KUBECTL) delete secret scim-dev-secrets -n $(NAMESPACE) --ignore-not-found

# ─────────────────────────────────────────────────────────────────────────────
# logs — tail both app and cloudflared containers simultaneously
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: logs
logs:
	$(KUBECTL) logs -f -n $(NAMESPACE) deployment/scim-dev --all-containers=true --prefix=true

# ─────────────────────────────────────────────────────────────────────────────
# port-forward — direct access to the app on localhost:3000
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: port-forward
port-forward:
	$(KUBECTL) port-forward -n $(NAMESPACE) svc/scim-dev 3000:3000

# ─────────────────────────────────────────────────────────────────────────────
# status — quick overview of pods, services, and recent events
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: status
status:
	@echo "\n=== Pods ==="; \
	$(KUBECTL) get pods -n $(NAMESPACE) -o wide; \
	echo "\n=== Services ==="; \
	$(KUBECTL) get svc  -n $(NAMESPACE); \
	echo "\n=== Recent events ==="; \
	$(KUBECTL) get events -n $(NAMESPACE) --sort-by='.lastTimestamp' | tail -15

# ─────────────────────────────────────────────────────────────────────────────
# configmap-check — abort if k8s/configmap.yaml still has YOUR_* placeholders
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: configmap-check
configmap-check:
	@if grep -v '^\s*#' $(K8S)/configmap.yaml | grep -q 'YOUR_'; then \
		echo ""; \
		echo "ERROR: k8s/configmap.yaml still has YOUR_* placeholders."; \
		echo "  Fill in NEXT_PUBLIC_BASE_URL, NEXTAUTH_URL, OKTA_CLIENT_ID, OKTA_ISSUER."; \
		echo ""; \
		exit 1; \
	fi

# ─────────────────────────────────────────────────────────────────────────────
# db-init — apply scripts/init-postgres.sql inside the postgres pod
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: db-init
db-init:
	@echo "Waiting for postgres-0 to be Ready..."
	@$(KUBECTL) wait pod/postgres-0 -n $(NAMESPACE) --for=condition=Ready --timeout=120s
	$(KUBECTL) exec -i -n $(NAMESPACE) pod/postgres-0 -- \
		psql -U postgres -d scim_dev < scripts/init-postgres.sql
	@echo "Database schema applied."

# ─────────────────────────────────────────────────────────────────────────────
# db-psql — interactive psql session inside the postgres pod
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: db-psql
db-psql:
	$(KUBECTL) exec -it -n $(NAMESPACE) pod/postgres-0 -- psql -U postgres -d scim_dev

# ─────────────────────────────────────────────────────────────────────────────
# postgres-forward — expose postgres on localhost:5432 for local GUI tools
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: postgres-forward
postgres-forward:
	$(KUBECTL) port-forward -n $(NAMESPACE) svc/postgres 5432:5432
