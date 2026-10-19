# SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

UUID := simple-screenshot@local
ARCHIVE := dist/$(UUID).shell-extension.zip

.PHONY: check pack release-assets install uninstall run-editor clean

check:
	sh scripts/check.sh

pack:
	mkdir -p dist
	gnome-extensions pack --force --out-dir dist \
		--extra-source=annotations.js \
		--extra-source=capture.js \
		--extra-source=geometry.js \
		--extra-source=i18n.js \
		--extra-source=indicator.js \
		--extra-source=overlay.js \
		--extra-source=editor \
		extension
	zip -q -j $(ARCHIVE) LICENSE LICENSE-APACHE LICENSE-GPL NOTICE

release-assets: check
	cd dist && sha256sum $(notdir $(ARCHIVE)) > $(notdir $(ARCHIVE)).sha256

install: check
	sh scripts/install.sh

uninstall:
	sh scripts/uninstall.sh

run-editor:
	gjs -m extension/editor/main.js tests/fixture.svg

clean:
	$(RM) $(ARCHIVE) $(ARCHIVE).sha256
