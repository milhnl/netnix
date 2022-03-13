.POSIX:
.SILENT:
.PHONY: install uninstall

install: ump.sh yt_title_clean.sh
	awk '/^\. / { f=$$2; while (getline < f) print; next; } { print; }' \
		<ump.sh >"${DESTDIR}${PREFIX}/bin/ump"
	chmod 755 "${DESTDIR}${PREFIX}/bin/ump"
	awk '/^\. / { f=$$2; while (getline < f) print; next; } { print; }' \
		<yt_title_clean.sh >"${DESTDIR}${PREFIX}/bin/yt_title_clean"
	chmod 755 "${DESTDIR}${PREFIX}/bin/yt_title_clean"
	awk '/^\. / { f=$$2; while (getline < f) print; next; } { print; }' \
		<tv.sh >"${DESTDIR}${PREFIX}/bin/tv"
	chmod 755 "${DESTDIR}${PREFIX}/bin/tv"

uninstall:
	rm -f "${DESTDIR}${PREFIX}/bin/ump" \
	rm -f "${DESTDIR}${PREFIX}/bin/yt_title_clean" \
	rm -f "${DESTDIR}${PREFIX}/bin/tv"

frontend/dist/index.html: frontend/index.html frontend/index.tsx \
		Makefile frontend/deps/preact.ts frontend/deps/wouter-preact.ts
	mkdir -p frontend/dist
	deno bundle --config=frontend/deno.json frontend/index.tsx \
		>frontend/dist/index.js
	<frontend/index.html awk '\
		/<!-- MODULE -->/ { \
			while (getline <"frontend/dist/index.js") print; \
			next; \
		} \
		{ print $$0; } \
	' >frontend/dist/index.html
	rm frontend/dist/index.js
