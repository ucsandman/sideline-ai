import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { useRevenueCat } from '../../lib/revenuecat';
import {
  fetchAllPlayers,
  fetchLeagueRosters,
} from '../../lib/sleeper';
import {
  buildChatSystemPrompt,
  getLlmProvider,
  LlmNotConfiguredError,
} from '../../lib/llm';
import type { LlmMessage } from '../../lib/llm';
import {
  currentWeekKey,
  FREE_CHAT_PER_WEEK,
  getChatUsage,
  incrementChatUsage,
} from '../../lib/storage';
import { playerDisplayName } from '../../lib/types';
import type { ChatMessage } from '../../lib/types';
import { LoadingView } from '../../components/LoadingView';

const CONTEXT_LIMIT = 4000;

function newMessage(role: 'user' | 'assistant', text: string): ChatMessage {
  return {
    createdAt: Date.now(),
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
  };
}

function toLlmMessages(messages: ChatMessage[]): LlmMessage[] {
  return messages.map((m) => ({ content: m.text, role: m.role }));
}

export default function Chat() {
  const { user, leagues, selectedLeagueIds } = useSession();
  const { isPro } = useRevenueCat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState(0);
  const [leagueContext, setLeagueContext] = useState('');
  const [contextReady, setContextReady] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const appendMessage = useCallback((msg: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
  }, []);

  const buildLeagueContext = useCallback(async (): Promise<string> => {
    const players = await fetchAllPlayers();
    const parts: string[] = [];
    for (const leagueId of selectedLeagueIds) {
      const league = leagues.find((l) => l.league_id === leagueId);
      if (!league) continue;
      const rosters = await fetchLeagueRosters(leagueId);
      const mine = rosters.find((r) => r.owner_id === user?.user_id);
      const wins = mine?.settings?.wins ?? 0;
      const losses = mine?.settings?.losses ?? 0;
      const names = (mine?.players ?? []).slice(0, 40).map((id) => {
        const p = players[id];
        if (!p) return id;
        const pos = p.position ?? '?';
        const team = p.team ?? 'FA';
        return `${playerDisplayName(p, id)} (${pos}, ${team})`;
      });
      parts.push(`${league.name} (${wins}-${losses}): ${names.join(', ')}`);
    }
    const ctx = parts.join('\n');
    return ctx.length > CONTEXT_LIMIT ? ctx.slice(0, CONTEXT_LIMIT) : ctx;
  }, [user, leagues, selectedLeagueIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const usageCount = await getChatUsage(currentWeekKey());
        if (!cancelled) setUsage(usageCount);
      } catch {
        // usage stays at 0
      }
      try {
        const ctx = await buildLeagueContext();
        if (!cancelled) {
          setLeagueContext(ctx || 'No league data available.');
          setContextReady(true);
        }
      } catch {
        if (!cancelled) {
          setLeagueContext('No league data available.');
          setContextReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildLeagueContext]);

  const atLimit = usage >= FREE_CHAT_PER_WEEK && !isPro;

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const weekKey = currentWeekKey();
    let currentUsage = usage;
    try {
      currentUsage = await getChatUsage(weekKey);
      setUsage(currentUsage);
    } catch {
      // fall through with cached usage
    }
    if (currentUsage >= FREE_CHAT_PER_WEEK && !isPro) {
      return;
    }
    setDraft('');
    setSending(true);
    try {
      await incrementChatUsage(weekKey);
    } catch {
      // non-fatal, keep going
    }
    const userMsg = newMessage('user', text);
    appendMessage(userMsg);
    try {
      const provider = getLlmProvider();
      const llmMessages: LlmMessage[] = [
        { role: 'system', content: buildChatSystemPrompt(leagueContext) },
        ...toLlmMessages(messagesRef.current),
      ];
      const reply = await provider.chat(llmMessages);
      appendMessage(newMessage('assistant', reply));
    } catch (e) {
      if (e instanceof LlmNotConfiguredError) {
        appendMessage(
          newMessage('assistant', 'AI is not configured in this build yet.'),
        );
      } else {
        appendMessage(
          newMessage('assistant', 'Something went wrong. Try again.'),
        );
      }
    } finally {
      setSending(false);
      try {
        setUsage(await getChatUsage(weekKey));
      } catch {
        // ignore
      }
    }
  }, [draft, sending, usage, isPro, leagueContext, appendMessage]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[styles.bubbleRow, isUser ? styles.userRow : styles.assistantRow]}
      >
        <View
          style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
        >
          <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Co-pilot</Text>
        {!isPro ? (
          <Text style={styles.usage}>
            {Math.max(0, FREE_CHAT_PER_WEEK - usage)} of {FREE_CHAT_PER_WEEK} free
            chats left this week
          </Text>
        ) : null}
      </View>
      {!contextReady ? (
        <LoadingView label="Loading your leagues..." />
      ) : (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, index) => String(index)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Ask about start/sit calls, waiver targets, or trade ideas. I
                  know your rosters.
                </Text>
              </View>
            }
          />
          {atLimit ? (
            <View style={styles.limitPanel}>
              <Text style={styles.limitTitle}>
                You have used your {FREE_CHAT_PER_WEEK} free chats this week.
              </Text>
              <Text style={styles.limitBody}>
                Go Pro for unlimited chats plus the AI lineup optimizer.
              </Text>
              <Pressable
                style={styles.button}
                onPress={() => router.push('/paywall')}
              >
                <Text style={styles.buttonText}>Go Pro</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask your co-pilot..."
                value={draft}
                onChangeText={setDraft}
                multiline
                editable={!sending}
                onSubmitEditing={() => void send()}
              />
              <Pressable
                style={[styles.send, (sending || !draft.trim()) && styles.sendDisabled]}
                onPress={() => void send()}
                disabled={sending || !draft.trim()}
              >
                <Text style={styles.sendText}>
                  {sending ? '...' : 'Send'}
                </Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  assistantBubble: {
    backgroundColor: '#E2E8F0',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  body: {
    flex: 1,
  },
  bubble: {
    borderRadius: 16,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  bubbleText: {
    color: '#0F172A',
    fontSize: 15,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#0B1F3A',
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    marginRight: 8,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    padding: 12,
  },
  limitBody: {
    color: '#475569',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  limitPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderTopWidth: 1,
    padding: 20,
  },
  limitTitle: {
    color: '#0B1F3A',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  list: {
    flexGrow: 1,
    paddingVertical: 12,
  },
  safe: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  send: {
    alignItems: 'center',
    backgroundColor: '#0B1F3A',
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: '#0B1F3A',
    fontSize: 26,
    fontWeight: '700',
  },
  usage: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  userBubble: {
    backgroundColor: '#0B1F3A',
  },
  userBubbleText: {
    color: '#FFFFFF',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
});
