TSX := pnpm exec tsx
RUN := src/run.ts

.PHONY: help all list ask see json smoke route verify account count math install

help:
	@echo "make          run every case"
	@echo "make list     list case ids"
	@echo "make ask      type a state + yes/no question"
	@echo "make see      describe a picture (vision chat model, not Jev)"
	@echo "make smoke    support-ticket triage"
	@echo "make route    next-tool pick"
	@echo "make verify   claim vs evidence"
	@echo "make account  structured JSON state"
	@echo "make count    counting (known weak spot)"
	@echo "make math     arithmetic (known weak spot)"
	@echo "make json     raw JSON for every case"
	@echo "make install  pnpm install"

all:
	$(TSX) $(RUN)

list:
	$(TSX) $(RUN) --list

ask:
	$(TSX) $(RUN) ask

see:
	$(TSX) $(RUN) see $(IMAGE)

json:
	$(TSX) $(RUN) --json

smoke:
	$(TSX) $(RUN) smoke

route:
	$(TSX) $(RUN) route

verify:
	$(TSX) $(RUN) verify

account:
	$(TSX) $(RUN) account

count:
	$(TSX) $(RUN) count

math:
	$(TSX) $(RUN) math

install:
	pnpm install
