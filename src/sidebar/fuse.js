// Lightweight Fuzzy Search Implementation
// Compatible alternative to Fuse.js for browser extension

export default class FuzzySearch {
  constructor(data, options = {}) {
    this.data = data || [];
    this.options = {
      keys: options.keys || ['title', 'url'],
      threshold: options.threshold || 0.4,
      location: options.location || 0,
      distance: options.distance || 100,
      includeScore: options.includeScore || false,
      includeMatches: options.includeMatches || false,
      ignoreLocation: options.ignoreLocation || false,
      minMatchCharLength: options.minMatchCharLength || 1,
      ...options
    };
  }

  search(query) {
    if (!query || !query.trim()) {
      return [];
    }

    const results = [];
    const searchQuery = query.toLowerCase().trim();

    this.data.forEach((item, index) => {
      const searchResult = this.searchItem(item, searchQuery, index);
      if (searchResult.isMatch) {
        results.push(searchResult);
      }
    });

    // Sort by score (lower is better)
    results.sort((a, b) => a.score - b.score);

    return results.map(result => ({
      item: result.item,
      score: result.score,
      matches: this.options.includeMatches ? result.matches : undefined
    }));
  }

  searchItem(item, query, index) {
    let bestScore = Infinity;
    let isMatch = false;
    let matches = [];

    this.options.keys.forEach(keyConfig => {
      const key = typeof keyConfig === 'string' ? keyConfig : keyConfig.name;
      const weight = typeof keyConfig === 'object' ? keyConfig.weight || 1 : 1;

      const value = this.getValue(item, key);
      if (!value) return;

      const searchResult = this.fuzzyMatch(value, query);
      if (searchResult.isMatch) {
        isMatch = true;
        const weightedScore = searchResult.score / weight;

        if (weightedScore < bestScore) {
          bestScore = weightedScore;
        }

        if (this.options.includeMatches && searchResult.indices) {
          matches.push({
            key: key,
            value: value,
            indices: searchResult.indices
          });
        }
      }
    });

    return {
      isMatch,
      score: isMatch ? bestScore : 1,
      item,
      matches: this.options.includeMatches ? matches : undefined
    };
  }

  getValue(item, key) {
    // Handle nested keys like 'data.title'
    const keys = key.split('.');
    let value = item;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value ? String(value).toLowerCase() : null;
  }

  fuzzyMatch(text, pattern) {
    if (!text || !pattern) {
      return { isMatch: false, score: 1, indices: [] };
    }

    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();

    // Exact match gets best score
    if (textLower.includes(patternLower)) {
      const startIndex = textLower.indexOf(patternLower);
      return {
        isMatch: true,
        score: 0.1,
        indices: [[startIndex, startIndex + patternLower.length - 1]]
      };
    }

    // Fuzzy matching using Bitap algorithm (simplified)
    const result = this.bitapSearch(textLower, patternLower);

    if (result.isMatch && result.score <= this.options.threshold) {
      return result;
    }

    return { isMatch: false, score: 1, indices: [] };
  }

  bitapSearch(text, pattern) {
    const patternLength = pattern.length;
    const textLength = text.length;

    if (patternLength === 0) {
      return { isMatch: true, score: 0, indices: [] };
    }

    if (patternLength > textLength) {
      return { isMatch: false, score: 1, indices: [] };
    }

    // Simple character-by-character matching with gaps allowed
    let matches = [];
    let patternIndex = 0;
    let lastMatchIndex = -1;

    for (let textIndex = 0; textIndex < textLength && patternIndex < patternLength; textIndex++) {
      if (text[textIndex] === pattern[patternIndex]) {
        if (patternIndex === 0) {
          matches = [[textIndex, textIndex]];
        } else {
          // Extend or create new match range
          if (textIndex === lastMatchIndex + 1) {
            // Consecutive match - extend range
            matches[matches.length - 1][1] = textIndex;
          } else {
            // Gap in matches - new range
            matches.push([textIndex, textIndex]);
          }
        }
        lastMatchIndex = textIndex;
        patternIndex++;
      }
    }

    const isMatch = patternIndex === patternLength;
    let score = 1;

    if (isMatch) {
      // Calculate score based on match density and position
      const matchedChars = patternLength;
      const totalSpan = matches.length > 0 ? matches[matches.length - 1][1] - matches[0][0] + 1 : patternLength;
      const density = matchedChars / totalSpan;
      const position = matches.length > 0 ? matches[0][0] / textLength : 0;

      score = (1 - density) * 0.6 + position * 0.4;
    }

    return {
      isMatch,
      score,
      indices: isMatch ? matches : []
    };
  }

  // Method to add new items
  add(item) {
    this.data.push(item);
  }

  // Method to remove items
  remove(predicate) {
    const removed = [];
    this.data = this.data.filter((item, index) => {
      if (predicate(item, index)) {
        removed.push(item);
        return false;
      }
      return true;
    });
    return removed;
  }

  // Method to update the dataset
  setCollection(newData) {
    this.data = newData || [];
  }

  // Get current data
  getCollection() {
    return this.data;
  }
}
