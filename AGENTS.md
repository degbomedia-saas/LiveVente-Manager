# Règles de sécurité du projet

## Interdictions absolues

- Ne jamais coder en dur des clés, mots de passe ou tokens. Toujours utiliser les variables d'environnement.

- Ne jamais logger des données sensibles (mots de passe, tokens, données de paiement).

- Ne jamais concaténer directement les entrées utilisateur dans des requêtes SQL ou des commandes shell.

## Obligations

- Toute Server Action ou Route API doit vérifier l'authentification et les permissions côté serveur.

- Toute entrée utilisateur doit être validée avec Zod avant d'atteindre la logique métier.

- Les politiques RLS de Supabase doivent être appliquées sur TOUTES les tables.

- Le company_id doit être vérifié côté serveur, jamais faire confiance au client.

## Règles d'économie de quota (Tokens)

- Ne lis que les fichiers strictement nécessaires à la tâche en cours.

- Sois extrêmement concis dans tes réponses. Ne fournis pas de longues explications, va droit au but.

- Ne réécris pas des fichiers entiers si seule une petite modification est nécessaire. Fournis uniquement le code modifié (diff).

- Ne génère pas de code commenté inutilement.

- Si tu as besoin de me poser une question, pose-la immédiatement au lieu de faire des suppositions coûteuses en jetons.

## Rappel

Lis toujours ce fichier avant de proposer du code.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
