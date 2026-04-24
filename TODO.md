# TODO


## Cosmetics

- Add support for multiple trees
- Cleanup the UI, usability refactor
- Add a in-popup settings tab with material design v2 based switches for the most common functionality
- We need to optimize the tab filtering logic(already synced/all), with 1000+ tabs its getting pretty slow to work with

## Features

- Add "save website" functionality
  - Default storage backend "workspace" which will create a copy of the website in WORKSPACE_ROOT/data/a/website/<ulid>.html
    - backend concern, blocked by canvas-server, more details in the canvas-server repo
  - Support opening a stored website instead of a live one
  - Codebase should be inspired by https://github.com/gildas-lormeau/singlefile
  - Needs proper UI toggles, bells and whistles
