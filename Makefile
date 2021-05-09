.POSIX:
.SILENT:
.PHONY: install uninstall

install: ump.sh yt_title_clean.sh
	cp ump.sh "${DESTDIR}${PREFIX}/bin/ump"
	chmod 755 "${DESTDIR}${PREFIX}/bin/ump"
	cp yt_title_clean.sh "${DESTDIR}${PREFIX}/bin/yt_title_clean"
	chmod 755 "${DESTDIR}${PREFIX}/bin/yt_title_clean"
	cp tv.sh "${DESTDIR}${PREFIX}/bin/tv"
	chmod 755 "${DESTDIR}${PREFIX}/bin/tv"

uninstall:
	rm -f "${DESTDIR}${PREFIX}/bin/ump" \
	rm -f "${DESTDIR}${PREFIX}/bin/yt_title_clean" \
	rm -f "${DESTDIR}${PREFIX}/bin/tv"
