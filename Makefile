.POSIX:
.SILENT:
.PHONY: install uninstall

install: ump.sh
	cp ump.sh "${DESTDIR}${PREFIX}/bin/ump"
	chmod 755 "${DESTDIR}${PREFIX}/bin/ump"

uninstall:
	@rm -f "${DESTDIR}${PREFIX}/bin/ump" \
