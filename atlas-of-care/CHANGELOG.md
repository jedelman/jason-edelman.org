# Changelog

All of this happened on 2026-11-14. The pull request numbers are in
`jedelman/jason-edelman.org`.

- **#60–#64.** The atlas began as statistics tinted onto a map: 29 world layers and
  local ones, from Our World in Data, the WHO, the ILO, County Health Rankings, NFHS-5
  and Eurostat, with 56 researched case studies and a Prior work section.
- **#65.** The two questions were put at the top of the page, and vouches were added.
- **#66.** Jason dropped the case studies. They are in git history as
  `data/entries.json`.
- **#67.** Jason dropped the statistics, to put the whole page on people finding each
  other. The value files (`data/*.values.json`), the scripts that built them
  (`build/`) and the rebuild steps in the README are in git history.
- **#68.** A vouch could only be for another account that had added an entry. Before
  this it could be for an account or a web address. Signed-in people were shown the
  accounts they follow.
- **#70.** An entry had been a bare web address ("no free text"). Jason brought free
  text back as I-statements only, and a vouch became a pointer at one statement. Vouch
  records in either earlier form are not counted; as far as is known none were written
  outside tests.
- **#71.** Jason dropped the map ("We should probably drop the map at this point.
  Maybe a force directed graph? Also likes!!! You can like something even if you can't
  vouch for it. RAMPANT POSITIVITY"). The graph and likes were added, and the
  numbered steps after he asked for "clear instructions". A place became an optional name from a list, and records stopped holding
  coordinates. The boundary files and the map code are in git history.
- **#72.** The atlas was added to the site's front page.
