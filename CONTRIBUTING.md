# Guide de contribution

## Langue du projet

**Ce projet utilise exclusivement le français.** Toutes les contributions doivent respecter cette règle sans exception.

## Éléments concernés

- 📝 Commentaires de code
- 📚 Documentation (README, guides, etc.)
- 🔍 Reviews de pull requests
- 💬 Messages de commit
- 🐛 Issues et bug reports
- 💡 Suggestions d'amélioration

## Qualité des reviews

Chaque review de code doit :

1. **Identifier clairement le problème** en français
2. **Proposer une solution concrète** et immédiatement applicable
3. **Fournir le code corrigé** si nécessaire
4. **Expliquer la raison** du changement proposé

### Exemple de review efficace :

```markdown
## Problème identifié
Cette fonction ne gère pas les cas d'erreur réseau.

## Solution proposée
Ajouter un try-catch avec gestion d'erreur :

```typescript
try {
  const response = await fetch(url);
  return await response.json();
} catch (error) {
  console.error('Erreur réseau:', error);
  return null;
}
```

## Raison
Cela évite que l'application plante en cas de perte de connexion.
```

## Instructions détaillées

Consultez [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) pour les directives complètes, particulièrement importantes pour les outils d'IA et d'assistance au développement.

## Validation

Avant de soumettre une contribution :

- [ ] Tous les commentaires sont en français
- [ ] La documentation ajoutée/modifiée est en français
- [ ] Les messages de commit sont en français
- [ ] Les reviews fournissent des solutions applicables
- [ ] Le code respecte les conventions du projet