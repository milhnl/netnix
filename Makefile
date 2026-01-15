.POSIX:
.PHONY: install uninstall format

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
	cargo install --root "${DESTDIR}${PREFIX}" --path .

uninstall:
	rm -f "${DESTDIR}${PREFIX}/bin/ump" \
	rm -f "${DESTDIR}${PREFIX}/bin/yt_title_clean" \
	rm -f "${DESTDIR}${PREFIX}/bin/tv"

format:
	npx prettier --print-width 79 --write '**/*.{ts,tsx,html}'
	deno fmt

frontend/dist/index.html: Makefile frontend/index.html frontend/index.tsx \
		frontend/App.tsx frontend/auth.tsx frontend/context.ts \
		frontend/fileView.tsx frontend/mediasessionHook.ts frontend/music.tsx \
		frontend/player.tsx frontend/playState.ts frontend/video.tsx \
		frontend/ui.tsx frontend/utility.ts
	mkdir -p frontend/dist
	cd frontend; deno bundle --platform browser --output dist/index.js index.tsx
	<frontend/index.html awk '\
		/<!-- MODULE -->/ { \
			while (getline <"frontend/dist/index.js") print; \
			next; \
		} \
		{ print $$0; } \
	' >frontend/dist/index.html
	rm frontend/dist/index.js
