## [1.10.0](https://github.com/Null-Sweat-LLC/theDenverNexus/compare/test2doc-playwright-v1.9.0...test2doc-playwright-v1.10.0) (2026-09-26)

### Features

* **test2doc-playwright:** add filename annotation for screenshots ([5129f74](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/5129f74d1fe68a301873706231d3acec6de3c0cf)), closes [#509](https://github.com/Null-Sweat-LLC/theDenverNexus/issues/509)
* **test2doc-playwright:** support multi-line annotation labels ([5f76017](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/5f76017491e2aa106e32cff7ab2e51b9bbad5930)), closes [#282](https://github.com/Null-Sweat-LLC/theDenverNexus/issues/282)

### Bug Fixes

* **test2doc-playwright:** fix build and add guard on scaleProgressBar ([a6e6165](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/a6e6165f326a0094a2bc6c3a3f7c178a2db0dd0f))
* **test2doc-playwright:** keep annotation labels inside the viewport and off their target ([7a2bd9e](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/7a2bd9e4be52b9ed90d01bd21423b0cd7476e14f)), closes [#516](https://github.com/Null-Sweat-LLC/theDenverNexus/issues/516)
* **test2doc-playwright:** remove postinstall script ([7649138](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/7649138383396c9e827588797bfbffbc8e93dc54))
* **test2doc-playwright:** scale progress bar to terminal width to prevent line wrapping ([697278c](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/697278c475ea2d0e26539491e46c7fda410389df))

## [1.9.0](https://github.com/Null-Sweat-LLC/theDenverNexus/compare/test2doc-playwright-v1.8.0...test2doc-playwright-v1.9.0) (2026-05-17)

### Features

* **ci/cd:** github action to deploy nullsweat brochure ([2a2ebdb](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/2a2ebdbf351c59c2ea6da064e1691cca5276341f))
* **ci/cd:** maybe I just had claude fix the semver release for the monorepo? ([7f96a23](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/7f96a230d495ce4a42e4c6f1aafc56d2c9eb5b50))
* **nullsweat-brouchure:** added link to ScheduleLord ([aa6c495](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/aa6c495c05553fe8eed629673a82fd842fb72f86))
* **test2doc-docs:** add doc on injectMarkdown function ([13b9b16](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/13b9b16e5fea091006d908ab26bca080e04b5437))
* **test2doc-docs:** documentation on how to version the docs ([4ded83e](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/4ded83e96da22ce51b70bf7121f7f3c7f80096b2))
* **test2doc-playwright:** injectMarkdown helper function to add arbitrary markdown to steps ([45e129b](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/45e129b5e0c846c62f7fbab87ff251b79a570adc)), closes [#498](https://github.com/Null-Sweat-LLC/theDenverNexus/issues/498)

### Bug Fixes

* **ci/cd:** add pnpm install for nullsweat.io deploy GHA ([d37063a](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/d37063a53ad72d0899843758cbfabe24dc599b70))
* **ci/cd:** also disable browser download for playwright-passkey-gen ([afed1ec](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/afed1ec48219dc3f1060872013bcb0a64b9f9f90))
* **ci/cd:** configure git to trust container for semantic-release ([591cd0e](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/591cd0ebe3ac11a3f5b329e26518b7929b147ab6))
* **ci/cd:** for test2doc deploy avoid postinstall in ci/cd pipeline ([b4231a4](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/b4231a4e7a5d0f0397d43ae43c7408796e549aa3))
* **ci/cd:** point playwright test at container browsers instead of looking for npm installed ones ([8aed4c5](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/8aed4c5b849cee58355175668c102fc64941db89))
* **ci/cd:** switching to npx to deploy nullsweat.io ([577d7a9](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/577d7a9357571096bff09eab98018fba4eb62851))
* **ci/cd:** try making a dediated install step for browsers ([9a09846](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/9a09846d94de036891c85deb3ed68e71eec535b5))
* **ci/cd:** trying to see if enabling the post install will pick up the container installs ([01d8de8](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/01d8de8e3052de724267d0c70d5ce490cc7191da))
* **ci/cd:** trying to skip installing browsers in ci/cd ([1051fbe](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/1051fbed1652d6b5304e7f47037402ebcc8764a6))
* **ci/cd:** turns out I was fixing the wrong yml file ([86b07f9](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/86b07f9079c905305e23b3cb6f809f37670c3976))
* **ci/cd:** update playwright container, avoid dl browsers ([ddd2391](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/ddd23911951b65c51661e242065e55c4ff0860f7))
* **test2doc-playwright:** fix annotation rendering under dialog ([ae5bf6a](https://github.com/Null-Sweat-LLC/theDenverNexus/commit/ae5bf6a7f3ea608716680b7e7a554f15129598bd)), closes [#400](https://github.com/Null-Sweat-LLC/theDenverNexus/issues/400)
