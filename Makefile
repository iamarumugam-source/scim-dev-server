IMAGE     := scim-dev-server
TAG       := latest
NAMESPACE := scim-dev
K8S       := k8s

# ─────────────────────────────────────────────────────────────────────────────
# image-build
#   Builds the Docker image *inside* minikube's Docker daemon so Kubernetes can
#   pull it without a registry (imagePullPolicy: Never).
#
#   How it works:
#     eval $(minikube docker-env) temporarily points your shell's DOCKER_HOST
#     at minikube's Docker daemon.  The build runs there, not on your laptop.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: image-build
image-build:
	eval $$(minikube docker-env) && \
	docker build -t $(IMAGE):$(TAG) .

# ─────────────────────────────────────────────────────────────────────────────
# deploy
#   Applies every manifest in k8s/ (via kustomize) and waits for the rollout.
#   Run `make secrets-check` first to catch unfilled placeholders.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: deploy
deploy: secrets-check
	kubectl apply -k $(K8S)/
	kubectl rollout status deployment/scim-dev -n $(NAMESPACE) --timeout=120s

# ─────────────────────────────────────────────────────────────────────────────
# redeploy
#   Rebuilds the image and force-restarts the deployment in one step.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: redeploy
redeploy: image-build
	kubectl rollout restart deployment/scim-dev -n $(NAMESPACE)
	kubectl rollout status  deployment/scim-dev -n $(NAMESPACE) --timeout=120s

# ─────────────────────────────────────────────────────────────────────────────
# undeploy — remove all cluster resources (keeps the image in minikube)
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: undeploy
undeploy:
	kubectl delete -k $(K8S)/ --ignore-not-found

# ─────────────────────────────────────────────────────────────────────────────
# logs — tail both app and cloudflared containers simultaneously
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: logs
logs:
	kubectl logs -f -n $(NAMESPACE) deployment/scim-dev --all-containers=true --prefix=true

# ─────────────────────────────────────────────────────────────────────────────
# port-forward — direct access to the app on localhost:3000, bypassing the
#               Cloudflare tunnel (useful for debugging auth redirects).
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: port-forward
port-forward:
	kubectl port-forward -n $(NAMESPACE) svc/scim-dev 3000:3000

# ─────────────────────────────────────────────────────────────────────────────
# status — quick overview of pods, services, and recent events
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: status
status:
	@echo "\n=== Pods ==="; \
	kubectl get pods -n $(NAMESPACE) -o wide; \
	echo "\n=== Services ==="; \
	kubectl get svc  -n $(NAMESPACE); \
	echo "\n=== Recent events ==="; \
	kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp' | tail -15

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
# db-init — initialise the external postgres database
#            Requires POSTGRES_URL to be exported in the current shell.
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: db-init
db-init:
	@if [ -z "$$POSTGRES_URL" ]; then \
		echo "ERROR: POSTGRES_URL is not set. Export it first:"; \
		echo "  export POSTGRES_URL=postgresql://user:pass@host:5432/scim_dev"; \
		exit 1; \
	fi
	psql "$$POSTGRES_URL" -f scripts/init-postgres.sql
	@echo "Database schema applied."
