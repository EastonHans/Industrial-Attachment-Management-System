import React, { useEffect, useRef, useState } from 'react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string) => void;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange, onSelect }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const autocompleteServiceRef = useRef<any>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);

  useEffect(() => {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;
    // Use the new AutocompleteSuggestion API if available
    if (window.google.maps.places.AutocompleteSuggestion) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteSuggestion();
    } else if (window.google.maps.places.AutocompleteService) {
      // fallback for legacy
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
  }, []);

  useEffect(() => {
    if (!autocompleteServiceRef.current || !value) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const fetchSuggestions = setTimeout(() => {
      // Use .suggest for AutocompleteSuggestion, .getPlacePredictions for AutocompleteService
      if (autocompleteServiceRef.current.suggest) {
        autocompleteServiceRef.current.suggest(
          { input: value },
          (predictions, status) => {
            setLoading(false);
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              setSuggestions(predictions);
            } else {
              setSuggestions([]);
            }
          }
        );
      } else if (autocompleteServiceRef.current.getPlacePredictions) {
        autocompleteServiceRef.current.getPlacePredictions(
          { input: value },
          (predictions, status) => {
            setLoading(false);
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              setSuggestions(predictions);
            } else {
              setSuggestions([]);
            }
          }
        );
      } else {
        setLoading(false);
        setSuggestions([]);
      }
    }, 300); // debounce
    return () => clearTimeout(fetchSuggestions);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setActiveSuggestion(-1);
  };

  const handleSuggestionClick = (suggestion: any) => {
    onSelect(suggestion.description);
    setSuggestions([]);
    setActiveSuggestion(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      setActiveSuggestion((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      handleSuggestionClick(suggestions[activeSuggestion]);
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Start typing address..."
        className="w-full px-3 py-2 border rounded"
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <div className="bg-white border rounded shadow mt-1 z-10 absolute w-full">
          {loading && <div className="p-2 text-gray-500">Loading...</div>}
          {suggestions.map((suggestion, idx) => {
            const className =
              idx === activeSuggestion
                ? 'p-2 bg-blue-100 cursor-pointer'
                : 'p-2 cursor-pointer';
            return (
              <div
                key={suggestion.place_id || suggestion.placeId || idx}
                className={className}
                onMouseDown={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setActiveSuggestion(idx)}
              >
                {suggestion.description}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete; 