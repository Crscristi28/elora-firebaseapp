import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { ChatSession, ChatMessage } from '../types';

export const useFirestoreSync = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Effect 1: Listen for changes to the user's chat SESSIONS
  useEffect(() => {
    if (!user?.uid) {
      setSessions([]);
      setMessages([]);
      setCurrentSessionId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/chats`),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const sessionsData: ChatSession[] = [];
      querySnapshot.forEach((doc) => {
        // We don't include the 'messages' array here, as it's a subcollection
        const { messages, ...sessionData } = doc.data();
        sessionsData.push({ id: doc.id, ...sessionData } as ChatSession);
      });
      setSessions(sessionsData);

      // We removed the auto-selection logic here so the app starts on the main screen (null).
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Sync currentSessionId with sessions list (handle deletion)
  useEffect(() => {
    if (currentSessionId && sessions.length > 0) {
      const exists = sessions.find(s => s.id === currentSessionId);
      if (!exists) {
        setCurrentSessionId(null);
      }
    }
  }, [sessions, currentSessionId]);

  // Effect 2: Listen for changes to the MESSAGES of the CURRENTLY ACTIVE chat
  useEffect(() => {
    if (!user?.uid || !currentSessionId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/chats/${currentSessionId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: ChatMessage[] = [];
      querySnapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [user?.uid, currentSessionId]);

  // --- Functions to WRITE data to Firestore ---

  const addMessageToDb = async (sessionId: string, message: ChatMessage) => {
    if (!user?.uid || !sessionId) return;
    const { id, ...messageData } = message;

    // Add the message to the subcollection
    const docRef = await addDoc(
      collection(db, `users/${user.uid}/chats/${sessionId}/messages`),
      messageData
    );

    // Update the parent session's 'updatedAt' timestamp
    await setDoc(
      doc(db, `users/${user.uid}/chats`, sessionId),
      { updatedAt: Timestamp.now().toMillis() },
      { merge: true }
    );
    return docRef.id; // Return the new message ID
  };

  const updateMessageInDb = async (sessionId: string, messageId: string, data: Partial<ChatMessage>) => {
    if (!user?.uid || !sessionId || !messageId) return;
    await setDoc(
        doc(db, `users/${user.uid}/chats/${sessionId}/messages`, messageId),
        data,
        { merge: true }
    );
  };

  const createNewChatInDb = async (newSession: Omit<ChatSession, 'messages'>) => {
    if (!user?.uid) return null;
    await setDoc(doc(db, `users/${user.uid}/chats`, newSession.id), {
        ...newSession,
        userId: user.uid,
    });
    return newSession.id;
  };

  const deleteChatInDb = async (sessionId: string) => {
    if (!user?.uid) return;
    // For production, deleting subcollections requires a Cloud Function.
    // This will only delete the main chat document for now.
    await deleteDoc(doc(db, `users/${user.uid}/chats`, sessionId));
  };

  const renameChatInDb = async (sessionId: string, newTitle: string) => {
      if (!user?.uid) return;
      await setDoc(
          doc(db, `users/${user.uid}/chats`, sessionId),
          { title: newTitle, updatedAt: Timestamp.now().toMillis() },
          { merge: true }
      );
  };

  // --- Settings Sync Functions (Non-blocking) ---

  const fetchUserNameFromDb = async (): Promise<string | null> => {
    if (!user?.uid) return null;
    try {
      const docSnap = await getDoc(doc(db, `users/${user.uid}/settings`, 'app'));
      if (docSnap.exists()) {
        return docSnap.data()?.userName || null;
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch userName from Firestore:', e);
      return null;
    }
  };

  const saveUserNameToDb = (userName: string) => {
    if (!user?.uid) return;
    // Fire-and-forget - NO await, NO blocking
    setDoc(
      doc(db, `users/${user.uid}/settings`, 'app'),
      { userName },
      { merge: true }
    ).catch(e => console.error('Failed to save userName to Firestore:', e));
  };

  return {
    sessions,
    messages,
    currentSessionId,
    setCurrentSessionId,
    loading,
    addMessageToDb,
    updateMessageInDb,
    createNewChatInDb,
    deleteChatInDb,
    renameChatInDb,
    fetchUserNameFromDb,
    saveUserNameToDb,
  };
};
