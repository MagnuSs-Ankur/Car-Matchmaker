'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './page.module.css';

function CarCard({ car, onSave, isSaved, isSaving }) {
  return (
    <div className={styles.carCard}>
      <div className={styles.carCardHeader}>
        <div>
          <h3 className={styles.carName}>{car.make} {car.model}</h3>
          <p className={styles.carVariant}>{car.variant}</p>
        </div>
        <span className={styles.carPrice}>${car.price.toLocaleString()}</span>
      </div>

      <blockquote className={styles.reasoning}>
        {car.aiReasoning}
      </blockquote>

      <ul className={styles.specGrid}>
        <li><span className={styles.specLabel}>Type</span><span>{car.specs.bodyType}</span></li>
        <li><span className={styles.specLabel}>Seats</span><span>{car.specs.seating}</span></li>
        <li><span className={styles.specLabel}>MPG</span><span>{car.mileage}</span></li>
        <li><span className={styles.specLabel}>HP</span><span>{car.specs.horsepower}</span></li>
        <li><span className={styles.specLabel}>Safety</span><span>{car.safetyRating}/5 ⭐</span></li>
        <li><span className={styles.specLabel}>Reviews</span><span>{car.userReviews.averageScore}/5</span></li>
      </ul>

      <button
        className={`${styles.saveBtn} ${isSaved ? styles.saveBtnSaved : ''}`}
        onClick={() => onSave(car._id)}
        disabled={isSaved || isSaving}
      >
        {isSaving ? 'Saving…' : isSaved ? '✓ Saved to Shortlist' : 'Save to Shortlist'}
      </button>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className={styles.typingBubble}>
      <span></span><span></span><span></span>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your Car Matchmaker. Tell me what you're looking for — your budget, how you'll use it, how many people you carry, must-have features, anything. I'll find the best options for you.",
      matches: null 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [useCase, setUseCase] = useState('');
  const [budget, setBudget] = useState('');
  const [topPriority, setTopPriority] = useState('');
  const [savedIds, setSavedIds] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  // Stores the last extracted structured preferences so mid-conversation
  // changes (e.g. "increase budget to 90k") are applied as precise overrides,
  // not re-inferred from scratch.
  const [lastPreferences, setLastPreferences] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const buildHistoryForApi = useCallback(() => {
    // Convert messages to a simple text history for the LLM context
    return messages
      .filter(m => m.content) // Skip messages with no text
      .map(m => ({
        role: m.role,
        content: m.content
      }));
  }, [messages]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      const history = buildHistoryForApi();
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: trimmed, 
          useCase, 
          budget, 
          topPriority,
          history,
          // Send the previously extracted structured preferences as a baseline.
          // The LLM will apply the user's new request as a delta on top of it.
          previousPreferences: lastPreferences
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Sorry, something went wrong: ${data.error}`,
          matches: null 
        }]);
        return;
      }

      // Always persist the newly extracted preferences for the next turn
      if (data.preferences) {
        setLastPreferences(data.preferences);
      }

      if (!data.matches || data.matches.length === 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || "I couldn't find any cars matching those exact criteria. Could you try adjusting your budget or relaxing some requirements?",
          matches: null 
        }]);
        return;
      }

      const carNames = data.matches.map(m => `${m.make} ${m.model}`).join(', ');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Here are my top ${data.matches.length} picks for you: **${carNames}**. Let me know if you'd like to refine — cheaper, sportier, more space, different fuel type, anything works.`,
        matches: data.matches 
      }]);

    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I ran into a network error. Please try again.",
        matches: null 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const saveToShortlist = async (carId) => {
    setSavingId(carId);
    try {
      const res = await fetch('/api/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carId })
      });
      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(carId));
      }
    } catch (err) {
      console.error('Failed to save to shortlist', err);
    }
    setSavingId(null);
  };

  return (
    <main className={styles.chatContainer}>
      {/* Messages */}
      <div className={styles.messageList}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}>
            {msg.role === 'assistant' && (
              <div className={styles.avatar}>🚗</div>
            )}
            <div className={styles.messageBubbleWrapper}>
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                {msg.content}
              </div>
              {msg.matches && msg.matches.length > 0 && (
                <div className={styles.carCardList}>
                  {msg.matches.map((car, cIdx) => (
                    <CarCard
                      key={car._id}
                      car={car}
                      onSave={saveToShortlist}
                      isSaved={savedIds.has(car._id)}
                      isSaving={savingId === car._id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.messageRow} ${styles.assistantRow}`}>
            <div className={styles.avatar}>🚗</div>
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <button
          className={styles.filterToggle}
          onClick={() => setShowFilters(f => !f)}
          title="Optional filters"
        >
          ⚙️
        </button>

        {showFilters && (
          <div className={styles.filtersPanel}>
            <select value={useCase} onChange={e => setUseCase(e.target.value)}>
              <option value="">Use Case (Any)</option>
              <option value="Daily Commute">Daily Commute</option>
              <option value="Family Hauler">Family Hauler</option>
              <option value="Weekend Thrills">Weekend Thrills</option>
              <option value="Utility / Towing">Utility / Towing</option>
            </select>
            <select value={budget} onChange={e => setBudget(e.target.value)}>
              <option value="">Budget (Any)</option>
              <option value="Under $20k">Under $20k</option>
              <option value="$20k - $40k">$20k - $40k</option>
              <option value="$40k - $60k">$40k - $60k</option>
              <option value="Over $60k">Over $60k</option>
            </select>
            <select value={topPriority} onChange={e => setTopPriority(e.target.value)}>
              <option value="">Priority (Any)</option>
              <option value="Fuel Efficiency">Fuel Efficiency</option>
              <option value="Safety">Safety</option>
              <option value="Performance">Performance</option>
              <option value="Tech & Comfort">Tech & Comfort</option>
            </select>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <textarea
            ref={textareaRef}
            className={styles.chatInput}
            placeholder="Describe what you're looking for… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className={styles.sendBtn}
            disabled={!input.trim() || isLoading}
            title="Send"
          >
            {isLoading ? '…' : '↑'}
          </button>
        </form>
      </div>
    </main>
  );
}
