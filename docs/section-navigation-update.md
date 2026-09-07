# Section navigation and historical actions — 2026-09-08

The live workspace contained custom historical action names outside the short list introduced by the previous importer. Strict enumeration prevented all three existing documents from loading. Actions are now validated as non-empty strings and rendered as escaped text, with translated labels for known actions and the original label for custom ones. Empty/non-string fields still fail; existing records are neither rewritten nor dropped. The repository skill and Python contract use the same rule.

Background blocks now form a persistent section navigation strip in file order. Each button clears transient filters and focuses the block entrance at 85% zoom. The Overview button fits the canvas. Names and color marks match the corresponding backgrounds; layout, lock and layer controls remain available. This is visual navigation and never creates reasoning relationships. The five-domain HOI4 document stays in its separate local project, not this repository or deployment archive.

Validation: 13 data tests, including the actual local workspace with its custom actions and a private research file supplied through environment paths, passed without publishing the fixtures. Type checking and lint passed. Live browser acceptance is recorded in the consuming HOI4 project after deployment.
