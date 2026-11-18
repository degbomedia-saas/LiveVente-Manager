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

## Rappel

Lis toujours ce fichier avant de proposer du code.
