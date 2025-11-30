import { useState, useCallback, useEffect, useRef } from 'react';
import { usePDF } from '../contexts/PDFContext';
import { searchInDocument } from '../utils/pdfUtils';
import './SearchPanel.css';

interface SearchResult {
  pageNumber: number;
  matches: Array<{ text: string; index: number }>;
}

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const { pdfDocument, setCurrentPage, setSearchHighlight } = usePDF();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Clear results when search term changes
  useEffect(() => {
    setResults([]);
    setCurrentResultIndex(0);
    setSearchHighlight(null);
  }, [searchTerm, caseSensitive, setSearchHighlight]);

  // Clear highlight when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSearchHighlight(null);
    }
  }, [isOpen, setSearchHighlight]);

  const handleSearch = useCallback(async () => {
    if (!pdfDocument || !searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const searchResults = await searchInDocument(pdfDocument, searchTerm.trim(), caseSensitive);
      setResults(searchResults);
      setCurrentResultIndex(0);

      // Navigate to first result
      if (searchResults.length > 0) {
        setCurrentPage(searchResults[0].pageNumber);
        setSearchHighlight({
          pageNumber: searchResults[0].pageNumber,
          term: searchTerm.trim(),
          matchIndex: 0,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [pdfDocument, searchTerm, caseSensitive, setCurrentPage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        navigatePrev();
      } else if (results.length > 0) {
        navigateNext();
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSearch, results.length, onClose]);

  const navigateNext = useCallback(() => {
    if (results.length === 0) return;

    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
    const nextIndex = (currentResultIndex + 1) % totalMatches;
    setCurrentResultIndex(nextIndex);

    // Find which page this match is on
    let count = 0;
    for (const result of results) {
      if (count + result.matches.length > nextIndex) {
        setCurrentPage(result.pageNumber);
        setSearchHighlight({
          pageNumber: result.pageNumber,
          term: searchTerm.trim(),
          matchIndex: nextIndex - count,
        });
        break;
      }
      count += result.matches.length;
    }
  }, [results, currentResultIndex, searchTerm, setCurrentPage, setSearchHighlight]);

  const navigatePrev = useCallback(() => {
    if (results.length === 0) return;

    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
    const prevIndex = (currentResultIndex - 1 + totalMatches) % totalMatches;
    setCurrentResultIndex(prevIndex);

    // Find which page this match is on
    let count = 0;
    for (const result of results) {
      if (count + result.matches.length > prevIndex) {
        setCurrentPage(result.pageNumber);
        setSearchHighlight({
          pageNumber: result.pageNumber,
          term: searchTerm.trim(),
          matchIndex: prevIndex - count,
        });
        break;
      }
      count += result.matches.length;
    }
  }, [results, currentResultIndex, searchTerm, setCurrentPage, setSearchHighlight]);

  const goToResult = useCallback((pageNumber: number, matchIndex: number) => {
    setCurrentPage(pageNumber);
    setSearchHighlight({
      pageNumber,
      term: searchTerm.trim(),
      matchIndex,
    });

    // Calculate global index
    let globalIndex = 0;
    for (const result of results) {
      if (result.pageNumber === pageNumber) {
        globalIndex += matchIndex;
        break;
      }
      globalIndex += result.matches.length;
    }
    setCurrentResultIndex(globalIndex);
  }, [results, searchTerm, setCurrentPage, setSearchHighlight]);

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  if (!isOpen) return null;

  return (
    <div className="search-panel">
      <div className="search-header">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search in document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="search-btn"
            onClick={handleSearch}
            disabled={isSearching || !searchTerm.trim()}
            title="Search (Enter)"
          >
            {isSearching ? '...' : '🔍'}
          </button>
        </div>
        <div className="search-options">
          <label className="search-option">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            <span>Match case</span>
          </label>
        </div>
        <button className="search-close" onClick={onClose} title="Close (Esc)">×</button>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          <div className="search-nav">
            <span className="search-count">
              {currentResultIndex + 1} of {totalMatches} matches
            </span>
            <div className="search-nav-buttons">
              <button onClick={navigatePrev} title="Previous (Shift+Enter)">▲</button>
              <button onClick={navigateNext} title="Next (Enter)">▼</button>
            </div>
          </div>
          <div className="search-results-list">
            {results.map((result) => (
              <div key={result.pageNumber} className="search-result-page">
                <div className="search-result-page-header">
                  Page {result.pageNumber} ({result.matches.length} match{result.matches.length !== 1 ? 'es' : ''})
                </div>
                {result.matches.slice(0, 5).map((match, idx) => (
                  <button
                    key={idx}
                    className="search-result-item"
                    onClick={() => goToResult(result.pageNumber, idx)}
                  >
                    ...{match.text}...
                  </button>
                ))}
                {result.matches.length > 5 && (
                  <div className="search-result-more">
                    +{result.matches.length - 5} more
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {searchTerm && !isSearching && results.length === 0 && (
        <div className="search-no-results">
          No matches found
        </div>
      )}
    </div>
  );
}
