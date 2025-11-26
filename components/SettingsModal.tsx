import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Monitor, Keyboard, Mic, Database, Globe, Info, Trash2, Download, Check, User, Sparkles, MessageSquare, LogOut, Sliders, Activity } from 'lucide-react';
import { AppSettings, ChatSession, UserProfile, PromptSettings, ToneStyle, TONE_PROMPTS } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  sessions: ChatSession[];
  onClearAllChats: () => void;
  user: UserProfile | null;
  onSignOut: () => void;
  promptSettings: PromptSettings;
  onUpdatePromptSettings: (newSettings: PromptSettings) => void;
}

type SettingsTab = 'account' | 'personality' | 'preferences' | 'voice' | 'data' | 'about';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  sessions,
  onClearAllChats,
  user,
  onSignOut,
  promptSettings,
  onUpdatePromptSettings
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleExportData = () => {
    const dataStr = JSON.stringify(sessions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `elora-backup-${new Date().toISOString().slice(0,10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-center md:items-center items-end sm:p-4 p-0">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm animate-fade-in" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-[#1e1f20] w-full md:max-w-4xl md:h-[650px] h-[85vh] md:rounded-2xl rounded-t-[32px] rounded-b-none shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col md:flex-row overflow-hidden animate-slide-up">
        
        {/* Mobile Drag Handle (Visual Only) */}
        <div className="md:hidden w-full flex justify-center pt-3 pb-1 absolute top-0 z-10 pointer-events-none">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full opacity-50"></div>
        </div>

        {/* Sidebar Navigation */}
        <div className="w-full md:w-72 bg-gray-50 dark:bg-[#161719] border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible scrollbar-hide shrink-0 pt-8 md:pt-3">
          
          {/* User Mini Profile (Mobile only or Top of sidebar) */}
          {user && (
             <div className="hidden md:flex flex-col items-center p-6 mb-2 border-b border-gray-200 dark:border-gray-800/50">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-0.5 mb-3 shadow-lg shadow-purple-500/20">
                    <img 
                        src={user.photoURL || ''} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover bg-white dark:bg-black"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name='+user.displayName }}
                    />
                </div>
                <div className="text-base font-bold text-gray-900 dark:text-white truncate w-full text-center">{settings.userName || user.displayName}</div>
                <div className="text-xs text-gray-500 truncate w-full text-center">{user.email}</div>
             </div>
          )}

          {[
            { id: 'account', label: 'Account', icon: User },
            { id: 'personality', label: 'AI Personality', icon: Sparkles },
            { id: 'preferences', label: 'Preferences', icon: Sliders },
            { id: 'voice', label: 'Voice & Audio', icon: Mic },
            { id: 'data', label: 'Data & Privacy', icon: Database },
            { id: 'about', label: 'About', icon: Info },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as SettingsTab)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium whitespace-nowrap ${
                activeTab === item.id 
                  ? 'bg-white dark:bg-[#2d2e33] text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-white/5'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? 'text-blue-500' : 'text-gray-400'} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#1e1f20] relative">
          <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize tracking-tight">
                {activeTab === 'personality' ? 'AI Personality & Model' : activeTab}
            </h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 md:p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar pb-20 md:pb-8">
            
            {/* --- ACCOUNT TAB --- */}
            {activeTab === 'account' && user && (
                <div className="space-y-8 max-w-2xl mx-auto">
                    <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 dark:bg-[#252629] rounded-3xl border border-gray-100 dark:border-gray-700/50">
                        <img 
                            src={user.photoURL || ''} 
                            className="w-24 h-24 rounded-full object-cover bg-gray-200 shadow-xl"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name='+user.displayName }}
                        />
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{user.displayName}</h3>
                            <p className="text-gray-500">{user.email}</p>
                            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm">
                                PRO PLAN
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 px-1">Personalization</h3>
                        
                        {/* Preferred Name Input */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                                What should Elora call you?
                            </label>
                            <input 
                                type="text"
                                value={settings.userName || ''}
                                onChange={(e) => onUpdateSettings({ ...settings, userName: e.target.value })}
                                placeholder={user.displayName?.split(' ')[0] || "Your Name"}
                                className="w-full bg-gray-50 dark:bg-[#2d2e33] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                            <p className="text-xs text-gray-500 mt-2 px-1">
                                The AI will use this name to address you.
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 px-1">Account Actions</h3>
                        <button 
                            onClick={onSignOut}
                            className="w-full flex items-center justify-between px-5 py-4 bg-red-50 dark:bg-red-500/5 hover:bg-red-100 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-500/20 transition-all font-medium group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-200/50 dark:bg-red-500/20 rounded-lg group-hover:scale-110 transition-transform">
                                    <LogOut size={18} />
                                </div>
                                <span>Sign Out</span>
                            </div>
                            <span className="text-xs opacity-60">Ends current session</span>
                        </button>
                    </div>
                </div>
            )}

            {/* --- AI PERSONALITY TAB --- */}
            {activeTab === 'personality' && (
                <div className="space-y-8 max-w-2xl mx-auto">
                    {/* Tone Selector */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-100">Response Tone</label>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg capitalize">{promptSettings.style}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(['normal', 'concise', 'explanatory', 'formal', 'learning'] as ToneStyle[]).map((tone) => (
                                <button
                                    key={tone}
                                    onClick={() => onUpdatePromptSettings({ ...promptSettings, style: tone })}
                                    className={`relative px-4 py-3 rounded-2xl text-sm font-medium border-2 transition-all capitalize text-left ${
                                        promptSettings.style === tone
                                            ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm'
                                            : 'bg-white dark:bg-[#252629] border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2d2e33]'
                                    }`}
                                >
                                    <span className="block mb-0.5">{tone}</span>
                                    <span className="text-[10px] opacity-60 font-normal normal-case block">
                                        {tone === 'normal' ? 'Balanced & natural' : 
                                         tone === 'concise' ? 'Short & direct' : 
                                         tone === 'learning' ? 'Simple & educational' : 
                                         tone === 'formal' ? 'Professional & strict' : 'Detailed deep-dive'}
                                    </span>
                                    {promptSettings.style === tone && (
                                        <div className="absolute top-3 right-3 text-purple-500">
                                            <Check size={16} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* Creativity Slider */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-gray-900 dark:text-gray-100">Creativity Level</label>
                            <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                                Temp: {promptSettings.temperature}
                            </span>
                        </div>
                        <div className="px-1">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={promptSettings.temperature}
                                onChange={(e) => onUpdatePromptSettings({ ...promptSettings, temperature: parseFloat(e.target.value) })}
                                className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-2">
                                <span>Precise (0.0)</span>
                                <span>Balanced (0.5)</span>
                                <span>Creative (1.0)</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* System Instructions */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-900 dark:text-gray-100">Custom Instructions</label>
                        <textarea
                            value={promptSettings.systemInstruction || ''}
                            onChange={(e) => onUpdatePromptSettings({ ...promptSettings, systemInstruction: e.target.value })}
                            placeholder="e.g., You are a Python expert. Always explain code with comments..."
                            className="w-full h-32 bg-gray-50 dark:bg-[#252629] border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                        />
                        <p className="text-xs text-gray-500">These instructions override the default behavior.</p>
                    </div>
                </div>
            )}

            {/* --- PREFERENCES TAB --- */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 max-w-2xl mx-auto">
                {/* Theme */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-gray-900 dark:text-gray-100">Appearance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { val: 'system', label: 'System', icon: Monitor },
                      { val: 'dark', label: 'Dark', icon: Moon },
                      { val: 'light', label: 'Light', icon: Sun },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => onUpdateSettings({...settings, theme: opt.val as any})}
                        className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                          settings.theme === opt.val 
                            ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400' 
                            : 'bg-white dark:bg-[#252629] border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2d2e33]'
                        }`}
                      >
                        <opt.icon size={24} />
                        <span className="text-xs font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-gray-800" />

                {/* Show Suggestions Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#252629] rounded-2xl border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl text-purple-500">
                      <MessageSquare size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-200">Smart Suggestions</div>
                      <div className="text-xs text-gray-500">Auto-generate follow-up questions</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onUpdateSettings({...settings, showSuggestions: !settings.showSuggestions})}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      settings.showSuggestions ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                      settings.showSuggestions ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Enter to Send Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#252629] rounded-2xl border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl text-blue-500">
                      <Keyboard size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-200">Enter to Send</div>
                      <div className="text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onUpdateSettings({...settings, enterToSend: !settings.enterToSend})}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      settings.enterToSend ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                      settings.enterToSend ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* --- VOICE TAB --- */}
            {activeTab === 'voice' && (
              <div className="space-y-8 max-w-2xl mx-auto">
                 <div>
                    <label className="text-sm font-bold text-gray-900 dark:text-gray-100 block mb-3">Default Voice</label>
                    <div className="relative">
                        <select 
                            value={settings.defaultVoiceURI} 
                            onChange={(e) => onUpdateSettings({...settings, defaultVoiceURI: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-[#252629] border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500 appearance-none"
                        >
                            <option value="">System Default</option>
                            {voices.map((v: any) => (
                                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <Activity size={20} />
                        </div>
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                        <span>Speaking Rate</span>
                        <span className="text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{settings.defaultSpeechRate}x</span>
                    </div>
                    <div className="px-1">
                        <input 
                            type="range" min="0.5" max="2" step="0.1" 
                            value={settings.defaultSpeechRate} 
                            onChange={(e) => onUpdateSettings({...settings, defaultSpeechRate: parseFloat(e.target.value)})}
                            className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-2">
                            <span>Slow (0.5)</span>
                            <span>Normal (1.0)</span>
                            <span>Fast (2.0)</span>
                        </div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- DATA TAB --- */}
            {activeTab === 'data' && (
              <div className="space-y-6 max-w-2xl mx-auto">
                 <div className="p-5 bg-gray-50 dark:bg-[#252629] rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-200">Export Chat History</h3>
                            <p className="text-xs text-gray-500 mt-1">Download a JSON backup of your conversations.</p>
                        </div>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <Database size={20} />
                        </div>
                    </div>
                    <button 
                      onClick={handleExportData}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold transition-colors"
                    >
                      <Download size={18} /> Download Backup
                    </button>
                 </div>

                 <div className="p-5 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-100 dark:border-red-500/20">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-red-600 dark:text-red-400">Danger Zone</h3>
                            <p className="text-xs text-red-500/70 dark:text-red-300/70 mt-1">Irreversible actions.</p>
                        </div>
                        <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg">
                            <Trash2 size={20} />
                        </div>
                    </div>
                    <button 
                      onClick={() => {
                        if(window.confirm('Are you sure you want to delete ALL history? This cannot be undone.')) {
                            onClearAllChats();
                            onClose();
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-red-500/10 hover:bg-red-50 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl text-sm font-bold transition-colors"
                    >
                      Clear All History
                    </button>
                 </div>
              </div>
            )}
            
            {/* --- ABOUT TAB --- */}
            {activeTab === 'about' && (
              <div className="text-center space-y-8 py-8 max-w-lg mx-auto">
                 <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-teal-400 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30 rotate-3 hover:rotate-6 transition-transform duration-500">
                    <span className="text-5xl font-bold text-white">E</span>
                 </div>
                 
                 <div>
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 dark:from-blue-400 dark:to-teal-400">Elora</h2>
                    <p className="text-gray-400 text-sm mt-2 font-medium tracking-wide">Version 1.2.0 • Beta</p>
                 </div>

                 <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    A next-generation multimodal AI interface designed for seamless creativity and productivity. 
                    Powered by Gemini 2.5 Flash, Pro, and Imagine models.
                 </p>

                 <div className="pt-8 border-t border-gray-200 dark:border-gray-800 w-full">
                    <p className="text-xs text-gray-400 dark:text-gray-600">
                        &copy; {new Date().getFullYear()} Elora AI. All rights reserved.
                    </p>
                 </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
