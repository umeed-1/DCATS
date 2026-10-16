.PHONY: test build check run

test:
	npm test

build:
	npm run build

check:
	npm run check

run:
	npm run preview -- --host 0.0.0.0
