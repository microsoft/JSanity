# jSanity
A secure-by-default, performant, cross-browser client-side HTML sanitization library.

Reference:
[OWASP AppSec EU 2013 Talk](https://www.youtube.com/watch?v=n18Hwaxycwc)
[Slides](http://www.slideshare.net/404aspx/insane-in-the-iframe)

## Status

jSanity was just recently revived from two years of cold storage.  Only very minimal changes have been made so far since the code was originally developed.


## Demo / Benchmark pages

[Demo](http://jsanity.azurewebsites.net/jsanity-demo-pretty.htm)<br>
[Benchmark](http://jsanity.azurewebsites.net/jsanity-benchmark-pretty.htm)


## Todo
  - Support for more elements and attributes.
  - setImmediate didn't gain traction.  Switch to an alternative approach.
    - For now jSanity uses a polyfill.
  - Update / document the demo & benchmark pages
  - Unit tests
  - Remove requirement for jQuery (?)
  - Better solution for STYLE elements
  - Integration with one or more javascript frameworks
  - Experimental override for default sanitization in various web platforms
  - Leverage newer features of the web platform (Shadow DOM, etc.)


## Special thanks for making jSanity a reality:

  - Ben Livshits
  - Gareth Heyes
  - Loris D'Antoni
  - Mario Heiderich
  - Matt Thomlinson
  - Michael Fanning
