# Instructions pour l'Intelligence Artificielle

## Directives linguistiques

**IMPORTANT : Tous les commentaires, documentations, reviews, messages de commit, et communications liées au développement de ce projet DOIVENT être rédigés en français.**

## Règles de développement

### 1. Langue française obligatoire
- Tous les commentaires de code doivent être en français
- Toute la documentation (README, guides, etc.) doit être en français
- Les messages de commit doivent être en français
- Les issues et pull requests doivent être rédigées en français
- Les reviews de code doivent être effectuées en français

### 2. Reviews de code
- Chaque review doit impérativement fournir une **solution applicable immédiatement**
- Ne pas se contenter d'identifier les problèmes, mais proposer la correction exacte
- Inclure des exemples de code corrigé lorsque nécessaire
- Fournir les commandes précises à exécuter si applicable

### 3. Commentaires de code
- Expliquer le "pourquoi" plutôt que le "comment"
- Utiliser un français clair et professionnel
- Éviter les anglicismes quand des équivalents français existent

### 4. Documentation
- Rédiger en français avec des exemples clairs
- Inclure des solutions pas-à-pas pour les problèmes courants
- Maintenir une terminologie cohérente tout au long du projet

## Exemples de bonnes pratiques

### Review acceptable :
```
❌ "This function is inefficient"
✅ "Cette fonction est inefficace. Remplacez la boucle forEach par une boucle for classique :
    for (let i = 0; i < items.length; i++) { ... }"
```

### Commentaire de code acceptable :
```javascript
// ❌ This calculates the total
// ✅ Calcule le total des éléments en filtrant les valeurs nulles
const total = items.filter(item => item !== null).reduce((sum, item) => sum + item.value, 0);
```

### Message de commit acceptable :
```
❌ "Fix bug in component"
✅ "Corrige le bug d'affichage dans le composant Roms lors du chargement"
```

## Application stricte

Ces règles s'appliquent à :
- Tous les développeurs humains
- Toutes les intelligences artificielles
- Tous les outils automatisés (linters avec messages personnalisés, etc.)
- Toute la documentation générée automatiquement

**Aucune exception n'est tolérée sans justification explicite et validation préalable.**