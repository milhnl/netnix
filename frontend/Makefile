dist/index.html: index.html index.ts Makefile \
		deps/preact.ts deps/wouter-preact.ts
	mkdir -p dist
	deno bundle  --config=deno.json --no-check index.ts >dist/index.js
	<index.html awk '\
		/<!-- MODULE -->/ { \
			while ((getline line <"dist/index.js") > 0 ) { \
				print line; \
			} \
			next; \
		} \
		{ print $$0; } \
	' >dist/index.html
	rm dist/index.js
