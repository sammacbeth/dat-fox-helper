# Dat Browser Bridge

A bridge to the Dat network for use by browsers. Provides:

 * A HTTP proxy to load content from Dat (using [dat-gateway](https://github.com/sammacbeth/dat-gateway))
 * [Native messaging](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging) enabling compatible browser extensions to control this process,
 for example implementing the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html), or requesting certain Dats to be seeded
 locally.

This bridge is intended to run with the [dat-fox](https://github.com/sammacbeth/dat-fox)
prototype webextension for Firefox.
