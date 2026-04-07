IMAGE     := scim-dev-server
TAG       := latest
NAMESPACE := scim-dev
K8S       := k8s

# microk8s ships its own kubectl wrapper.
# If you've already exported the kubeconfig (`microk8s config > ~/.kube/config`)
# and are using a standalone kubectl, change this to: KUBECTL := kubectl
KUBECTL   := microk8s kubectl

# ─────────────────────────────────────────────────────────────────────────────
# image-build
#   Builds the Docker image with the local Docker daemon, then imports it
#   directly into microk8s's containerd so Kubernetes can use it without
#   a registry (imagePullPolicy: Never still applies).
#
#   How it works:
#     docker build    — standard build on the host
#     docker save     — serialise the image to a tar stream on stdout
#     microk8s ctr images import -
#                     — pipe the stream into microk8s's containerd (k8s.io namespace)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: image-build
image-build:
	docker build -t $(IMAGE):$(TAG) .
	docker save $(IMAGE):$(TAG) | microk8s ctr images import -

# ─────────────────────────────────────────────────────────────────────────────
# deploy
#   Applies every manifest in k8s/ (via kustomize) and waits for the rollout.
#   Run `make secrets-check` first to catch unfilled placeholders.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: deploy
deploy: secrets-check
	$(KUBECTL) apply -k $(K8S)/
	$(KUBECTL) rollout status deployment/scim-dev -n $(NAMESPACE) --timeout=120s

# ─────────────────────────────────────────────────────────────────────────────
# redeploy
#   Rebuilds the image and force-restarts the deployment in one step.
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

# ─────────────────────────────────────────────────────────────────────────────
# logs — tail both app and cloudflared containers simultaneously
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: logs
logs:
	$(KUBECTL) logs -f -n $(NAMESPACE) deployment/scim-dev --all-containers=true --prefix=true

# ─────────────────────────────────────────────────────────────────────────────
# port-forward — direct access to the app on localhost:3000, bypassing the
#               Cloudflare tunnel (useful for debugging auth redirects).
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
# secrets-check — abort if any secret value is still REPLACE_ME
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: secrets-check
secrets-check:
	@if grep -q 'REPLACE_ME' $(K8S)/secret.yaml; then \
		echo ""; \
		echo "ERROR: $(K8S)/secret.yaml still contains REPLACE_ME placeholders."; \
		echo "       Fill in every secret value before deploying."; \
		echo ""; \
		exit 1; \
	fi
	@if grep -q 'YOUR_' $(K8S)/configmap.yaml; then \
		echo ""; \
		echo "ERROR: $(K8S)/configmap.yaml still contains YOUR_* placeholders."; \
		echo "       Fill in your tunnel hostname and Okta config before deploying."; \
		echo ""; \
		exit 1; \
	fi

# ─────────────────────────────────────────────────────────────────────────────
# db-init — apply scripts/init-postgres.sql against the in-cluster postgres pod.
#            Waits until the pod is Ready, then pipes the SQL via kubectl exec.
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
# postgres-forward — forward postgres to localhost:5432 for local tools
#                    (TablePlus, DBeaver, psql, etc.)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: postgres-forward
postgres-forward:
	$(KUBECTL) port-forward -n $(NAMESPACE) svc/postgres 5432:5432
