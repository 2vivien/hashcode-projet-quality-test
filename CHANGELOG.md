# Changelog

Toutes les modifications importantes de HashCode Quality sont documentées dans ce fichier.

Le format suit l'esprit de Keep a Changelog et les versions suivent Semantic Versioning.

## [3.0.0] - 2026-09-28

### Added

- Proof Engine v3 avec requirements, acceptance criteria, invariants, risques, oracles, evidence, evaluations, proofs, regressions et gate.
- Frozen evaluation harness avec identité SHA-256 et détection de mutation.
- Datasets versionnés et adressés par hash.
- Proof Graph v2 avec hash de graphe et traçabilité complète.
- Oracle families déterministes, comparatives, property-based, state-machine, concurrency et sémantiques.
- Proof receipts auditables avec reproductibilité, evidence hashes et gaps explicites.
- CLI `prove`, `eval`, `evidence`, `regressions` et `explain-proof`.
- Proof-aware quality gate pour les contrôles à risque élevé/critique.
- Tests et documentation dédiés au Proof Engine v3.

### Changed

- Distinction explicite entre `PASS` et `PROVEN`.
- Les preuves insuffisantes ne sont plus transformées en succès implicites.
- Les evidence requirements sont vérifiées au niveau de chaque oracle.

## [2.0.0] - 2026-09-18

### Added

- Package npm `hashcode-quality`.
- CLI `hashcode-quality` avec `init`, `doctor`, `audit`, `check` et `prompt`.
- Support d'utilisation directe avec `npx` et `pnpm dlx`.
- Détection du stack projet et recommandations d'outils adaptées.
- Profils de qualité minimal, standard, production et AI.
- Architecture et documentation universelles de quality engineering.
- Prompts spécialisés pour audit, tests, sécurité, IA, issue intelligence et quality gate.
- Standards open source et fichiers de santé communautaire GitHub.

### Notes

Cette version constitue la base publique du package et de la CLI. Le moteur d'exécution multi-outils complet est une évolution prévue de la série 2.x.
