# Changelog

## [0.2.0](https://github.com/kieksme/kieks.me.cicd/compare/v0.1.0...v0.2.0) (2026-01-04)


### Features

* **colors:** add individual SVG files for each color to improve reusability and maintainability ([3854833](https://github.com/kieksme/kieks.me.cicd/commit/385483353718d8f9effe8fed8743089e6a8aae58))


### Bug Fixes

* add issues write permission for release-please in private repo ([a50ecfc](https://github.com/kieksme/kieks.me.cicd/commit/a50ecfccaa9e2b866e597e58aa833b40f1108bfd))
* explicitly pass GITHUB_TOKEN to release-please for private repo ([34e97f5](https://github.com/kieksme/kieks.me.cicd/commit/34e97f5fcc28cac7d858a9ffc6175d0d02aa8f8e))
* format .release-please-manifest.json with proper newline ([eadcb39](https://github.com/kieksme/kieks.me.cicd/commit/eadcb39f7403113a017c317dfdae1d8af77a026d))
* reformat .release-please-manifest.json to ensure clean JSON ([d212231](https://github.com/kieksme/kieks.me.cicd/commit/d212231a70b75fc1ae0190073c0fe11e4005e25d))
* remove manifest-file parameter to use checkout repository instead of GitHub API ([423fea7](https://github.com/kieksme/kieks.me.cicd/commit/423fea78a3cad836454ba247c2c0b7e3cb8b5a27))
* remove version-file config to use default manifest location ([a84c156](https://github.com/kieksme/kieks.me.cicd/commit/a84c15643d7ea6d1b95c421c85e19049b2911e2e))
* restore version-file config as required by release-please manifest setup ([9b2356a](https://github.com/kieksme/kieks.me.cicd/commit/9b2356aad79ed204ef11be89b2d9ba2e041b583f))
* use compact JSON format for manifest to avoid GitHub API parsing issues ([0e998fe](https://github.com/kieksme/kieks.me.cicd/commit/0e998fec946b37980e0d80dae44e152d10931bc5))


### Miscellaneous Chores

* release 0.2.0 ([9979965](https://github.com/kieksme/kieks.me.cicd/commit/99799650b59298531409eff081109641db8f0ebc))
