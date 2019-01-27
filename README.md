Nipple
======

A script to read the [osrs cache dumps that I produce](https://github.com/Abextm/osrs-cache/releases) 
and do interesting things with them. This is mostly just for my use, so there
isn't much attention payed to documentation or codestyle.

Usage
------

Run one of the following commands in a directory containing a cache dump. See the above link.
 - `nipple` - Open a new script
 - `nipple last` - Opens the last edited script
 - `nipple <filename>` - Opens a script by filename
 - `nipple download` - Dowloads the latest release of osrs-cache and extracts it to `dump`

Nipple opens a splitpane vim. Left pane is a nodejs script. Right pane is the
output of the left pane when it was last saved.

Installation
------------
1) Clone this repo
2) `npm install`
3) Add this directory to your path
4) `cd` to a working directory and `nipple download` to get the latest cache dump. I recommend doing this on a ramdisk so you can delete the 192k files faster.