dist/index.html: index.html index.tsx Makefile \
		deps/preact.ts deps/wouter-preact.ts
	mkdir -p dist
	deno bundle --config=deno.json index.tsx >dist/index.js
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
