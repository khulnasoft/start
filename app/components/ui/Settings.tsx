import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { DialogTitle, dialogVariants, dialogBackdropVariants } from './Dialog';
import { IconButton } from './IconButton';
import { providersList } from '~/lib/stores/settings';
import { db, getAll, deleteById } from '~/lib/persistence';
import { toast } from 'react-toastify';
import { useNavigate } from '@remix-run/react';
import commit from '~/commit.json';
import Cookies from 'js-cookie';
import { SettingsSlider } from './SettingsSlider';
import '~/styles/components/SettingsSlider.scss';
import '~/styles/components/Settings.scss';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'chat-history' | 'providers' | 'features' | 'debug';

// Providers that support base URL configuration
const URL_CONFIGURABLE_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'];

export const Settings = ({ open, onClose }: SettingsProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('chat-history');
  const [isDebugEnabled, setIsDebugEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJustSayEnabled, setIsJustSayEnabled] = useState(false);

  // Load base URLs from cookies
  const [baseUrls, setBaseUrls] = useState(() => {
    const savedUrls = Cookies.get('providerBaseUrls');

    if (savedUrls) {
      try {
        return JSON.parse(savedUrls);
      } catch (error) {
        console.error('Failed to parse base URLs from cookies:', error);
        return {
          Ollama: 'http://localhost:11434',
          LMStudio: 'http://localhost:1234',
          OpenAILike: '',
        };
      }
    }

    return {
      Ollama: 'http://localhost:11434',
      LMStudio: 'http://localhost:1234',
      OpenAILike: '',
    };
  });

  const handleBaseUrlChange = (provider: string, url: string) => {
    setBaseUrls((prev: Record<string, string>) => {
      const newUrls = { ...prev, [provider]: url };
      Cookies.set('providerBaseUrls', JSON.stringify(newUrls));

      return newUrls;
    });
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'chat-history', label: 'Chat History', icon: 'i-ph:book' },
    { id: 'providers', label: 'Providers', icon: 'i-ph:key' },
    { id: 'features', label: 'Features', icon: 'i-ph:star' },
    ...(isDebugEnabled ? [{ id: 'debug' as TabType, label: 'Debug Tab', icon: 'i-ph:bug' }] : []),
  ];

  // Load providers from cookies on mount
  const [providers, setProviders] = useState(() => {
    const savedProviders = Cookies.get('providers');

    if (savedProviders) {
      try {
        const parsedProviders = JSON.parse(savedProviders);

        // Merge saved enabled states with the base provider list
        return providersList.map((provider) => ({
          ...provider,
          isEnabled: parsedProviders[provider.name] || false,
        }));
      } catch (error) {
        console.error('Failed to parse providers from cookies:', error);
      }
    }

    return providersList;
  });

  const handleToggleProvider = (providerName: string) => {
    setProviders((prevProviders) => {
      const newProviders = prevProviders.map((provider) =>
        provider.name === providerName ? { ...provider, isEnabled: !provider.isEnabled } : provider,
      );

      // Save to cookies
      const enabledStates = newProviders.reduce(
        (acc, provider) => ({
          ...acc,
          [provider.name]: provider.isEnabled,
        }),
        {},
      );
      Cookies.set('providers', JSON.stringify(enabledStates));

      return newProviders;
    });
  };

  const filteredProviders = providers
    .filter((provider) => provider.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleCopyToClipboard = () => {
    const debugInfo = {
      OS: navigator.platform,
      Browser: navigator.userAgent,
      ActiveFeatures: providers.filter((provider) => provider.isEnabled).map((provider) => provider.name),
      BaseURLs: {
        Ollama: process.env.REACT_APP_OLLAMA_URL,
        OpenAI: process.env.REACT_APP_OPENAI_URL,
        LMStudio: process.env.REACT_APP_LM_STUDIO_URL,
      },
      Version: versionHash,
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2)).then(() => {
      alert('Debug information copied to clipboard!');
    });
  };

  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAllChats = async () => {
    if (!db) {
      toast.error('Database is not available');
      return;
    }

    try {
      setIsDeleting(true);

      const allChats = await getAll(db);

      // Delete all chats one by one
      await Promise.all(allChats.map((chat) => deleteById(db!, chat.id)));

      toast.success('All chats deleted successfully');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error('Failed to delete chats');
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportAllChats = async () => {
    if (!db) {
      toast.error('Database is not available');
      return;
    }

    try {
      const allChats = await getAll(db);
      const exportData = {
        chats: allChats,
        exportDate: new Date().toISOString(),
      };

      downloadAsJson(exportData, `all-chats-${new Date().toISOString()}.json`);
      toast.success('Chats exported successfully');
    } catch (error) {
      toast.error('Failed to export chats');
      console.error(error);
    }
  };

  const versionHash = commit.commit; // Get the version hash from commit.json

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild>
          <motion.div
            className="bg-black/50 fixed inset-0 z-max"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogBackdropVariants}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content asChild>
          <motion.div
            className="fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] border border-startgpt-elements-borderColor rounded-lg shadow-lg focus:outline-none overflow-hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
          >
            <div className="flex h-full">
              <div className="w-48 border-r border-startgpt-elements-borderColor bg-white dark:bg-gray-900 p-4 flex flex-col justify-between settings-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={classNames(activeTab === tab.id ? 'active' : '')}
                  >
                    <div className={tab.icon} />
                    {tab.label}
                  </button>
                ))}
                <div className="mt-auto flex flex-col gap-2">
                  <a
                    href="https://github.com/khulnasoft/startgpt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-button flex items-center gap-2"
                  >
                    <div className="i-ph:github-logo" />
                    GitHub
                  </a>
                  <a
                    href="https://khulnasoft.github.io/startgpt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settings-button flex items-center gap-2"
                  >
                    <div className="i-ph:book" />
                    Docs
                  </a>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-8 bg-gray-50 dark:bg-gray-800">
                <DialogTitle className="flex-shrink-0 text-lg font-semibold text-startgpt-elements-textPrimary">
                  Settings
                </DialogTitle>
                <div className="flex-1 overflow-y-auto">
                  {activeTab === 'chat-history' && (
                    <div className="p-4">
                      <h3 className="text-lg font-medium text-startgpt-elements-textPrimary mb-4">Chat History</h3>
                      <button
                        onClick={handleExportAllChats}
                        className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 mb-4 transition-colors duration-200"
                      >
                        Export All Chats
                      </button>

                      <div className="text-startgpt-elements-textPrimary rounded-lg p-4 mb-4 settings-danger-area">
                        <h4 className="font-semibold">Danger Area</h4>
                        <p className="mb-2">This action cannot be undone!</p>
                        <button
                          onClick={handleDeleteAllChats}
                          disabled={isDeleting}
                          className={classNames(
                            'bg-red-700 text-white rounded-lg px-4 py-2 transition-colors duration-200',
                            isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-800',
                          )}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete All Chats'}
                        </button>
                      </div>
                    </div>
                  )}
                  {activeTab === 'providers' && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-startgpt-elements-textPrimary">Providers</h3>
                        <input
                          type="text"
                          placeholder="Search providers..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="mb-4 p-2 rounded border border-gray-300"
                        />
                      </div>
                      {filteredProviders.map((provider) => (
                        <div
                          key={provider.name}
                          className="flex flex-col mb-6 provider-item hover:bg-startgpt-elements-bg-depth-3 p-4 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-startgpt-elements-textPrimary">{provider.name}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={provider.isEnabled}
                                onChange={() => handleToggleProvider(provider.name)}
                              />
                              <div
                                className={classNames(
                                  'settings-toggle__track',
                                  provider.isEnabled
                                    ? 'settings-toggle__track--enabled'
                                    : 'settings-toggle__track--disabled',
                                )}
                              ></div>
                              <div
                                className={classNames(
                                  'settings-toggle__thumb',
                                  provider.isEnabled ? 'settings-toggle__thumb--enabled' : '',
                                )}
                              ></div>
                            </label>
                          </div>
                          {/* Base URL input for configurable providers */}
                          {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && provider.isEnabled && (
                            <div className="mt-2">
                              <label className="block text-sm text-startgpt-elements-textSecondary mb-1">
                                Base URL:
                              </label>
                              <input
                                type="text"
                                value={baseUrls[provider.name]}
                                onChange={(e) => handleBaseUrlChange(provider.name, e.target.value)}
                                placeholder={`Enter ${provider.name} base URL`}
                                className="w-full p-2 rounded border border-startgpt-elements-borderColor bg-startgpt-elements-bg-depth-2 text-startgpt-elements-textPrimary text-sm"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'features' && (
                    <div className="p-4 bg-startgpt-elements-bg-depth-2 border border-startgpt-elements-borderColor rounded-lg mb-4">
                      <h3 className="text-lg font-medium text-startgpt-elements-textPrimary mb-4">Feature Settings</h3>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-startgpt-elements-textPrimary">Debug Info</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isDebugEnabled}
                            onChange={() => setIsDebugEnabled(!isDebugEnabled)}
                          />
                          <div
                            className={classNames(
                              'settings-toggle__track',
                              isDebugEnabled ? 'settings-toggle__track--enabled' : 'settings-toggle__track--disabled',
                            )}
                          ></div>
                          <div
                            className={classNames(
                              'settings-toggle__thumb',
                              isDebugEnabled ? 'settings-toggle__thumb--enabled' : '',
                            )}
                          ></div>
                        </label>
                      </div>
                    </div>
                  )}
                  {activeTab === 'features' && (
                    <div className="p-4 bg-startgpt-elements-bg-depth-2 border border-startgpt-elements-borderColor rounded-lg">
                      <h3 className="text-lg font-medium text-startgpt-elements-textPrimary mb-4">Experimental Area</h3>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-startgpt-elements-textPrimary">Replace with local models</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isJustSayEnabled}
                            onChange={() => setIsJustSayEnabled(!isJustSayEnabled)}
                          />
                          <div
                            className={classNames(
                              'settings-toggle__track',
                              isJustSayEnabled ? 'settings-toggle__track--enabled' : 'settings-toggle__track--disabled',
                            )}
                          ></div>
                          <div
                            className={classNames(
                              'settings-toggle__thumb',
                              isJustSayEnabled ? 'settings-toggle__thumb--enabled' : '',
                            )}
                          ></div>
                        </label>
                      </div>
                    </div>
                  )}
                  {activeTab === 'debug' && isDebugEnabled && (
                    <div className="p-4">
                      <h3 className="text-lg font-medium text-startgpt-elements-textPrimary mb-4">Debug Tab</h3>
                      <button
                        onClick={handleCopyToClipboard}
                        className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 mb-4 transition-colors duration-200"
                      >
                        Copy to Clipboard
                      </button>

                      <h4 className="text-md font-medium text-startgpt-elements-textPrimary">System Information</h4>
                      <p className="text-startgpt-elements-textSecondary">OS: {navigator.platform}</p>
                      <p className="text-startgpt-elements-textSecondary">Browser: {navigator.userAgent}</p>

                      <h4 className="text-md font-medium text-startgpt-elements-textPrimary mt-4">Active Features</h4>
                      <ul>
                        {providers
                          .filter((provider) => provider.isEnabled)
                          .map((provider) => (
                            <li key={provider.name} className="text-startgpt-elements-textSecondary">
                              {provider.name}
                            </li>
                          ))}
                      </ul>

                      <h4 className="text-md font-medium text-startgpt-elements-textPrimary mt-4">Base URLs</h4>
                      <ul>
                        <li className="text-startgpt-elements-textSecondary">
                          Ollama: {process.env.REACT_APP_OLLAMA_URL}
                        </li>
                        <li className="text-startgpt-elements-textSecondary">
                          OpenAI: {process.env.REACT_APP_OPENAI_URL}
                        </li>
                        <li className="text-startgpt-elements-textSecondary">
                          LM Studio: {process.env.REACT_APP_LM_STUDIO_URL}
                        </li>
                      </ul>

                      <h4 className="text-md font-medium text-startgpt-elements-textPrimary mt-4">
                        Version Information
                      </h4>
                      <p className="text-startgpt-elements-textSecondary">Version Hash: {versionHash}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <RadixDialog.Close asChild onClick={onClose}>
              <IconButton icon="i-ph:x" className="absolute top-[10px] right-[10px]" />
            </RadixDialog.Close>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};