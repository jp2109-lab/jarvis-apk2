import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";
import * as Linking from "expo-linking";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Bell,
  Bluetooth,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Globe2,
  Headphones,
  Menu,
  Mic,
  MoreHorizontal,
  Plus,
  Radio,
  Send,
  Settings2,
  Sparkles,
  Wifi,
  X,
  Zap,
} from "lucide-react-native";
import {
  ApiTask,
  createAutomation,
  createTask,
  getChatHistory,
  getTasks,
  saveChatHistory,
  signIn,
  updateTask,
} from "./src/api";

type Tab = "assistant" | "routines" | "agenda";
type Message = { id: string; sender: "USER" | "JARVIS"; text: string; timestamp: string };
type Shortcut = { id: string; name: string; scheme: string; color: string };
type LocalTask = ApiTask & { localOnly?: boolean };

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "youtube", name: "YouTube", scheme: "youtube://", color: "#ff5f6d" },
  { id: "gmail", name: "Gmail", scheme: "googlegmail://", color: "#f59e0b" },
  { id: "github", name: "GitHub", scheme: "github://", color: "#a78bfa" },
];

const initialMessage: Message = {
  id: "welcome",
  sender: "JARVIS",
  text: "Núcleo mobile inicializado. Posso abrir aplicativos, preparar conexões, criar alarmes e sincronizar sua agenda com o JARVIS Web.",
  timestamp: "agora",
};

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function pulse() {
  if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("assistant");
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingEnabled, setSpeakingEnabled] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("operador");
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppScheme, setNewAppScheme] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskMinutes, setTaskMinutes] = useState("10");
  const [syncState, setSyncState] = useState("local");

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status === "pending"), [tasks]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [storedToken, storedMessages, storedShortcuts] = await Promise.all([
        SecureStore.getItemAsync("jarvis_mobile_token"),
        AsyncStorage.getItem("jarvis_mobile_messages"),
        AsyncStorage.getItem("jarvis_mobile_shortcuts"),
      ]);
      if (!active) return;
      if (storedToken) setToken(storedToken);
      if (storedMessages) setMessages(JSON.parse(storedMessages));
      if (storedShortcuts) setShortcuts(JSON.parse(storedShortcuts));
      setBooting(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("jarvis_mobile_messages", JSON.stringify(messages)).catch(() => undefined);
  }, [messages]);

  useEffect(() => {
    AsyncStorage.setItem("jarvis_mobile_shortcuts", JSON.stringify(shortcuts)).catch(() => undefined);
  }, [shortcuts]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [history, remoteTasks] = await Promise.all([getChatHistory(token), getTasks(token)]);
        if (history.messages.length) setMessages(history.messages);
        setTasks(remoteTasks.tasks);
        setSyncState("sincronizado");
      } catch {
        setSyncState("offline · cache local");
      }
    })();
  }, [token]);

  const speak = (text: string) => {
    if (speakingEnabled) Speech.speak(text, { language: "pt-BR", rate: 0.95, pitch: 0.9 });
  };

  const addMessage = (sender: Message["sender"], text: string) => {
    setMessages((current) => [...current, { id: `${Date.now()}-${Math.random()}`, sender, text, timestamp: nowLabel() }].slice(-100));
  };

  const openShortcut = async (shortcut: Shortcut) => {
    await pulse();
    try {
      const supported = await Linking.canOpenURL(shortcut.scheme);
      if (!supported) throw new Error("Aplicativo não instalado ou esquema não suportado.");
      await Linking.openURL(shortcut.scheme);
      const reply = `Abrindo ${shortcut.name}.`;
      addMessage("JARVIS", reply);
      speak(reply);
    } catch {
      Alert.alert("Aplicativo não disponível", `Não foi possível abrir ${shortcut.name}. Confirme se o aplicativo está instalado e se o esquema foi configurado.`);
    }
  };

  const openConnectivitySettings = async (kind: "wifi" | "bluetooth") => {
    await pulse();
    if (Platform.OS !== "android") {
      Alert.alert("Disponível no Android", "A abertura direta das configurações de conectividade será habilitada no Android.");
      return;
    }
    await IntentLauncher.startActivityAsync(kind === "wifi" ? "android.settings.WIFI_SETTINGS" : "android.settings.BLUETOOTH_SETTINGS");
    addMessage("JARVIS", `Painel de ${kind === "wifi" ? "Wi‑Fi" : "Bluetooth"} aberto. A alteração final depende da confirmação do Android.`);
  };

  const handleCommand = async (value: string) => {
    const command = value.trim();
    if (!command) return;
    await pulse();
    addMessage("USER", command);
    setInput("");
    const normalized = command.toLowerCase();
    const shortcut = shortcuts.find((item) => normalized.includes(item.name.toLowerCase()));
    if ((normalized.includes("abrir") || normalized.includes("iniciar") || normalized.includes("executar")) && shortcut) {
      await openShortcut(shortcut);
      return;
    }
    if (normalized.includes("wi-fi") || normalized.includes("wifi")) {
      await openConnectivitySettings("wifi");
      return;
    }
    if (normalized.includes("bluetooth")) {
      await openConnectivitySettings("bluetooth");
      return;
    }
    if (normalized.includes("alarme") || normalized.includes("lembrete") || normalized.includes("tarefa")) {
      setTab("agenda");
      const reply = "Entendido. A central de agenda está pronta para transformar isso em lembrete ou alarme.";
      addMessage("JARVIS", reply);
      speak(reply);
      return;
    }
    const reply = token
      ? "Comando recebido. Estou mantendo este contexto no núcleo compartilhado; para ações avançadas, conecte o proxy de IA do JARVIS Web."
      : "Comando recebido localmente. Faça login para sincronizar esta conversa e usar o núcleo compartilhado do JARVIS Web.";
    addMessage("JARVIS", reply);
    speak(reply);
    if (token) saveChatHistory(token, [...messages, { id: `${Date.now()}`, sender: "USER", text: command, timestamp: nowLabel() }]).catch(() => undefined);
  };

  const createReminder = async () => {
    const title = taskTitle.trim();
    const minutes = Math.max(1, Number(taskMinutes) || 10);
    if (!title) return Alert.alert("Informe uma tarefa", "Digite um título para o lembrete.");
    const dueAt = new Date(Date.now() + minutes * 60_000);
    const localTask: LocalTask = { id: Date.now(), title, dueAt: dueAt.toISOString(), status: "pending", localOnly: !token };
    setTasks((current) => [localTask, ...current]);
    setTaskTitle("");
    await Notifications.scheduleNotificationAsync({
      content: { title: "J.A.R.V.I.S. · lembrete", body: title, data: { taskId: localTask.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, repeats: false },
    }).catch(() => undefined);
    if (token) {
      try {
        const remote = await createTask(token, { title, dueAt: dueAt.toISOString() });
        setTasks((current) => current.map((item) => item.id === localTask.id ? remote : item));
        setSyncState("sincronizado");
      } catch {
        setSyncState("lembrete local · aguardando sync");
      }
    }
    const reply = `Lembrete criado para ${minutes} minutos: ${title}.`;
    addMessage("JARVIS", reply);
    speak(reply);
  };

  const toggleTask = async (task: LocalTask) => {
    await pulse();
    const status = task.status === "done" ? "pending" : "done";
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    if (token && !task.localOnly) updateTask(token, task.id, status).catch(() => setSyncState("offline · cache local"));
  };

  const addShortcut = () => {
    if (!newAppName.trim() || !newAppScheme.trim()) return;
    setShortcuts((current) => [...current, { id: `${Date.now()}`, name: newAppName.trim(), scheme: newAppScheme.trim(), color: "#22d3ee" }]);
    setNewAppName("");
    setNewAppScheme("");
    setShowShortcutModal(false);
  };

  const saveRoutine = async (type: "wifi" | "bluetooth") => {
    await pulse();
    if (token) {
      try {
        await createAutomation(token, { name: `${type === "wifi" ? "Wi‑Fi" : "Bluetooth"} · abrir painel`, triggerType: "device", triggerConfig: { platform: "android" }, actionType: "open_settings", actionConfig: { settings: type } });
        setSyncState("rotina sincronizada");
      } catch { setSyncState("rotina local"); }
    }
    Alert.alert("Rotina preparada", `O painel de ${type === "wifi" ? "Wi‑Fi" : "Bluetooth"} será aberto pelo JARVIS quando esta rotina for acionada. O Android solicitará confirmação para mudanças sensíveis.`);
  };

  const login = async () => {
    if (!email.trim() || !password) return Alert.alert("Acesso ao núcleo", "Informe e-mail e senha da sua conta do JARVIS Web.");
    setLoginBusy(true);
    try {
      const result = await signIn(email.trim(), password);
      if (!result.sessionToken) throw new Error("O servidor não retornou um token mobile.");
      await SecureStore.setItemAsync("jarvis_mobile_token", result.sessionToken);
      setToken(result.sessionToken);
      setUserLabel(result.user.name || result.user.email || "operador");
      Alert.alert("Núcleo conectado", "Sua sessão mobile agora compartilha dados com o JARVIS Web.");
    } catch (error) {
      Alert.alert("Falha de autenticação", error instanceof Error ? error.message : "Não foi possível conectar ao JARVIS Web.");
    } finally { setLoginBusy(false); }
  };

  if (booting) return <View style={styles.boot}><StatusBar style="light" /><Sparkles color="#67e8f9" size={30} /><Text style={styles.bootTitle}>J.A.R.V.I.S.</Text><Text style={styles.bootSub}>INICIALIZANDO NÚCLEO MOBILE</Text></View>;

  if (!token) return <LoginScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} login={login} busy={loginBusy} />;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      <View style={styles.topBar}><View style={styles.brandMark}><Bot color="#071421" size={17} /></View><View style={{ flex: 1 }}><Text style={styles.brand}>J.A.R.V.I.S.</Text><Text style={styles.brandSub}>MOBILE COMMAND · {syncState.toUpperCase()}</Text></View><Pressable onPress={() => Alert.alert("Sessão", `Conectado como ${userLabel}.`)} style={styles.iconButton}><MoreHorizontal color="#8ba3b8" size={21} /></Pressable></View>
      <View style={styles.content}>
        {tab === "assistant" && <AssistantTab messages={messages} input={input} setInput={setInput} listening={listening} setListening={setListening} speakingEnabled={speakingEnabled} setSpeakingEnabled={setSpeakingEnabled} shortcuts={shortcuts} onCommand={handleCommand} onShortcut={openShortcut} />}
        {tab === "routines" && <RoutinesTab onWifi={() => saveRoutine("wifi")} onBluetooth={() => saveRoutine("bluetooth")} shortcuts={shortcuts} onShortcut={openShortcut} onAddShortcut={() => setShowShortcutModal(true)} />}
        {tab === "agenda" && <AgendaTab tasks={tasks} pendingCount={pendingTasks.length} taskTitle={taskTitle} setTaskTitle={setTaskTitle} taskMinutes={taskMinutes} setTaskMinutes={setTaskMinutes} onCreate={createReminder} onToggle={toggleTask} />}
      </View>
      <View style={styles.tabBar}><TabButton icon={<Bot size={19} />} label="Assistente" active={tab === "assistant"} onPress={() => setTab("assistant")} /><TabButton icon={<Radio size={19} />} label="Rotinas" active={tab === "routines"} onPress={() => setTab("routines")} /><TabButton icon={<CalendarClock size={19} />} label="Agenda" active={tab === "agenda"} badge={pendingTasks.length} onPress={() => setTab("agenda")} /></View>
      <Modal visible={showShortcutModal} transparent animationType="fade" onRequestClose={() => setShowShortcutModal(false)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHead}><Text style={styles.sectionTitle}>ADICIONAR APLICATIVO</Text><Pressable onPress={() => setShowShortcutModal(false)}><X color="#8ba3b8" /></Pressable></View><Text style={styles.fieldLabel}>Nome reconhecido pelo JARVIS</Text><TextInput value={newAppName} onChangeText={setNewAppName} placeholder="Ex.: Spotify" placeholderTextColor="#536b7f" style={styles.input} /><Text style={styles.fieldLabel}>Esquema Android</Text><TextInput value={newAppScheme} onChangeText={setNewAppScheme} placeholder="Ex.: spotify://" placeholderTextColor="#536b7f" autoCapitalize="none" style={styles.input} /><Pressable onPress={addShortcut} style={styles.primaryButton}><Plus color="#05131f" size={18} /><Text style={styles.primaryButtonText}>SALVAR ATALHO</Text></Pressable><Text style={styles.helper}>O aplicativo precisa aceitar o esquema informado. Para apps sem esquema público, use um módulo nativo de intent no build Android.</Text></View></View></Modal>
    </SafeAreaView>
  );
}

function LoginScreen({ email, password, setEmail, setPassword, login, busy }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; login: () => void; busy: boolean }) {
  return <SafeAreaView style={styles.app}><StatusBar style="light" /><View style={styles.loginWrap}><View style={styles.loginOrb}><Bot color="#071421" size={34} /></View><Text style={styles.loginTitle}>J.A.R.V.I.S.</Text><Text style={styles.loginSub}>NÚCLEO MOBILE · ACESSO SEGURO</Text><View style={styles.loginCard}><Text style={styles.fieldLabel}>E-mail sincronizado com o Web</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="operador@exemplo.com" placeholderTextColor="#536b7f" style={styles.input} /><Text style={styles.fieldLabel}>Senha</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor="#536b7f" style={styles.input} /><Pressable onPress={login} disabled={busy} style={[styles.primaryButton, busy && { opacity: 0.5 }]}><Zap color="#05131f" size={18} /><Text style={styles.primaryButtonText}>{busy ? "CONECTANDO..." : "CONECTAR AO NÚCLEO"}</Text></Pressable><Text style={styles.helper}>Use a mesma conta do JARVIS Web. O token fica protegido no armazenamento seguro do Android.</Text></View></View></SafeAreaView>;
}

function AssistantTab({ messages, input, setInput, listening, setListening, speakingEnabled, setSpeakingEnabled, shortcuts, onCommand, onShortcut }: { messages: Message[]; input: string; setInput: (value: string) => void; listening: boolean; setListening: (value: boolean) => void; speakingEnabled: boolean; setSpeakingEnabled: (value: boolean) => void; shortcuts: Shortcut[]; onCommand: (value: string) => void; onShortcut: (shortcut: Shortcut) => void }) {
  useSpeechRecognitionEvent("result", (event) => setInput(event.results[0]?.transcript || ""));
  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));
  const toggleListening = async () => {
    if (listening) return ExpoSpeechRecognitionModule.stop();
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) return Alert.alert("Microfone necessário", "Permita o microfone e o reconhecimento de voz para usar comandos falados.");
    ExpoSpeechRecognitionModule.start({ lang: "pt-BR", interimResults: true, continuous: false });
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.chatList} ListHeaderComponent={<View style={styles.chatHeader}><View style={styles.statusLine}><View style={styles.onlineDot} /><Text style={styles.statusText}>NÚCLEO ONLINE · PRONTO PARA COMANDOS</Text></View><Text style={styles.greeting}>O que vamos automatizar hoje?</Text><Text style={styles.greetingSub}>Fale com o assistente ou use uma ação rápida.</Text><View style={styles.quickGrid}><QuickAction icon={<Wifi color="#67e8f9" size={17} />} label="Abrir Wi‑Fi" onPress={() => onCommand("abrir wifi")} /><QuickAction icon={<Bluetooth color="#a78bfa" size={17} />} label="Bluetooth" onPress={() => onCommand("abrir bluetooth")} /><QuickAction icon={<Bell color="#fbbf24" size={17} />} label="Criar lembrete" onPress={() => onCommand("criar lembrete")} /><QuickAction icon={<Headphones color="#6ee7b7" size={17} />} label="Abrir YouTube" onPress={() => onCommand("abrir youtube")} /></View></View>} renderItem={({ item }) => <View style={[styles.messageRow, item.sender === "USER" && styles.messageRowUser]}><View style={[styles.avatar, item.sender === "USER" ? styles.userAvatar : styles.jarvisAvatar]}>{item.sender === "USER" ? <Text style={styles.avatarText}>EU</Text> : <Bot color="#071421" size={16} />}</View><View style={[styles.messageBubble, item.sender === "USER" ? styles.userBubble : styles.jarvisBubble]}><Text style={styles.messageText}>{item.text}</Text><Text style={styles.messageTime}>{item.timestamp}</Text></View></View>} ListFooterComponent={<View style={styles.chatFooter}><Text style={styles.footerLabel}>ATALHOS DE APLICATIVOS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{shortcuts.map((shortcut) => <Pressable key={shortcut.id} onPress={() => onShortcut(shortcut)} style={styles.shortcutChip}><View style={[styles.shortcutDot, { backgroundColor: shortcut.color }]} /><Text style={styles.shortcutText}>{shortcut.name}</Text><ChevronRight color="#5e7487" size={14} /></Pressable>)}</ScrollView></View>} />
    <View style={styles.composerWrap}><View style={styles.composer}><Pressable onPress={toggleListening} style={[styles.composerIcon, listening && styles.composerIconActive]}><Mic color={listening ? "#071421" : "#86a0b4"} size={19} /></Pressable><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => onCommand(input)} returnKeyType="send" placeholder={listening ? "Ouvindo comando..." : "Comando para JARVIS..."} placeholderTextColor="#536b7f" style={styles.composerInput} /><Pressable onPress={() => onCommand(input)} disabled={!input.trim()} style={[styles.sendButton, !input.trim() && { opacity: 0.35 }]}><Send color="#06121e" size={18} /></Pressable></View><View style={styles.composerMeta}><Text style={styles.helper}>Comandos locais + sincronização segura</Text><View style={styles.speakToggle}><Text style={styles.helper}>voz</Text><Switch value={speakingEnabled} onValueChange={setSpeakingEnabled} trackColor={{ false: "#243746", true: "#155e75" }} thumbColor={speakingEnabled ? "#67e8f9" : "#64748b"} /></View></View></View></KeyboardAvoidingView>;
}

function RoutinesTab({ onWifi, onBluetooth, shortcuts, onShortcut, onAddShortcut }: { onWifi: () => void; onBluetooth: () => void; shortcuts: Shortcut[]; onShortcut: (shortcut: Shortcut) => void; onAddShortcut: () => void }) {
  return <ScrollView contentContainerStyle={styles.page}><PageTitle eyebrow="AUTOMAÇÃO DO DISPOSITIVO" title="Rotinas e conexões" subtitle="Prepare ações rápidas para o JARVIS executar no Android." /><View style={styles.panel}><View style={styles.panelTitleRow}><View><Text style={styles.sectionTitle}>CONECTIVIDADE</Text><Text style={styles.panelSub}>O Android confirma alterações sensíveis.</Text></View><Cpu color="#67e8f9" size={20} /></View><RoutineRow icon={<Wifi color="#67e8f9" size={20} />} title="Wi‑Fi" subtitle="Abrir painel e preparar conexão" onPress={onWifi} /><RoutineRow icon={<Bluetooth color="#a78bfa" size={20} />} title="Bluetooth" subtitle="Gerenciar dispositivos pareados" onPress={onBluetooth} /></View><View style={styles.panel}><View style={styles.panelTitleRow}><View><Text style={styles.sectionTitle}>APLICATIVOS POR VOZ</Text><Text style={styles.panelSub}>Diga “abrir + nome do app”.</Text></View><Pressable onPress={onAddShortcut} style={styles.smallAdd}><Plus color="#05131f" size={16} /></Pressable></View>{shortcuts.map((shortcut) => <Pressable key={shortcut.id} onPress={() => onShortcut(shortcut)} style={styles.appRow}><View style={[styles.appIcon, { backgroundColor: shortcut.color }]}><Globe2 color="#071421" size={17} /></View><View style={{ flex: 1 }}><Text style={styles.appName}>{shortcut.name}</Text><Text style={styles.panelSub}>{shortcut.scheme}</Text></View><ChevronRight color="#698094" size={18} /></Pressable>)}</View><View style={styles.infoBox}><CircleHelp color="#67e8f9" size={17} /><Text style={styles.infoText}>Para iniciar qualquer aplicativo instalado, adicione o esquema Android correspondente. O próximo passo é integrar intents nativos para descoberta automática de apps.</Text></View></ScrollView>;
}

function AgendaTab({ tasks, pendingCount, taskTitle, setTaskTitle, taskMinutes, setTaskMinutes, onCreate, onToggle }: { tasks: LocalTask[]; pendingCount: number; taskTitle: string; setTaskTitle: (value: string) => void; taskMinutes: string; setTaskMinutes: (value: string) => void; onCreate: () => void; onToggle: (task: LocalTask) => void }) {
  return <ScrollView contentContainerStyle={styles.page}><PageTitle eyebrow="GERENCIADOR PESSOAL" title="Agenda e alarmes" subtitle={`${pendingCount} pendência(s) ativa(s) · notificações locais habilitadas`} /><View style={styles.panel}><Text style={styles.sectionTitle}>NOVO LEMBRETE</Text><TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Ex.: revisar projeto com a equipe" placeholderTextColor="#536b7f" style={styles.input} /><View style={styles.inlineForm}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Avisar em minutos</Text><TextInput value={taskMinutes} onChangeText={setTaskMinutes} keyboardType="number-pad" style={styles.input} /></View><Pressable onPress={onCreate} style={styles.primaryButtonSmall}><Bell color="#05131f" size={17} /><Text style={styles.primaryButtonText}>AGENDAR</Text></Pressable></View></View><View style={styles.panel}><View style={styles.panelTitleRow}><Text style={styles.sectionTitle}>PRÓXIMOS EVENTOS</Text><Clock3 color="#fbbf24" size={19} /></View>{tasks.length === 0 ? <Text style={styles.empty}>Nenhum lembrete ainda. O JARVIS avisará mesmo quando o app estiver fechado.</Text> : tasks.map((task) => <Pressable key={task.id} onPress={() => onToggle(task)} style={styles.taskRow}><View style={[styles.checkCircle, task.status === "done" && styles.checkCircleDone]}>{task.status === "done" && <Check color="#071421" size={13} />}</View><View style={{ flex: 1 }}><Text style={[styles.taskTitle, task.status === "done" && styles.taskDone]}>{task.title}</Text><Text style={styles.panelSub}>{task.dueAt ? new Date(task.dueAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem horário"}{task.localOnly ? " · local" : " · sincronizado"}</Text></View></Pressable>)}</View></ScrollView>;
}

function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <View style={styles.pageTitle}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.pageHeading}>{title}</Text><Text style={styles.pageSub}>{subtitle}</Text></View>; }
function RoutineRow({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.routineRow, pressed && { opacity: 0.72 }]}><View style={styles.routineIcon}>{icon}</View><View style={{ flex: 1 }}><Text style={styles.appName}>{title}</Text><Text style={styles.panelSub}>{subtitle}</Text></View><ChevronRight color="#698094" size={18} /></Pressable>; }
function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.quickAction}><View style={styles.quickIcon}>{icon}</View><Text style={styles.quickLabel}>{label}</Text></Pressable>; }
function TabButton({ icon, label, active, badge, onPress }: { icon: React.ReactNode; label: string; active: boolean; badge?: number; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>{icon}<Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>{badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}</Pressable>; }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#071421" },
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#071421" },
  bootTitle: { marginTop: 18, color: "#d9f9ff", fontSize: 22, letterSpacing: 5, fontWeight: "700" },
  bootSub: { marginTop: 8, color: "#5e8296", fontSize: 10, letterSpacing: 2 },
  topBar: { minHeight: 72, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#183246", backgroundColor: "#091b2b" },
  brandMark: { width: 34, height: 34, marginRight: 11, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#67e8f9" },
  brand: { color: "#d9f9ff", fontSize: 12, letterSpacing: 3, fontWeight: "800" },
  brandSub: { color: "#5e8296", fontSize: 8, letterSpacing: 1.3, marginTop: 4 },
  iconButton: { padding: 8 },
  content: { flex: 1 },
  tabBar: { paddingBottom: 7, paddingTop: 8, paddingHorizontal: 12, flexDirection: "row", borderTopWidth: 1, borderTopColor: "#183246", backgroundColor: "#091b2b" },
  tabButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, gap: 3 },
  tabButtonActive: { backgroundColor: "#10384b" },
  tabLabel: { color: "#6e8799", fontSize: 10 },
  tabLabelActive: { color: "#a9f4ff", fontWeight: "700" },
  badge: { position: "absolute", top: 3, right: 20, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#fbbf24" },
  badgeText: { color: "#071421", fontSize: 9, fontWeight: "800" },
  chatList: { padding: 18, paddingBottom: 12 },
  chatHeader: { paddingTop: 8, paddingBottom: 22 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#6ee7b7", shadowColor: "#6ee7b7", shadowOpacity: 0.8, shadowRadius: 8 },
  statusText: { color: "#6ee7b7", fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  greeting: { marginTop: 23, color: "#e1f8fb", fontSize: 24, fontWeight: "700", letterSpacing: 0.2 },
  greetingSub: { marginTop: 7, color: "#7792a3", fontSize: 13 },
  quickGrid: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAction: { width: "48%", padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#1b3a4d", backgroundColor: "#0a1d2d" },
  quickIcon: { width: 29, height: 29, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#102b3c" },
  quickLabel: { marginTop: 10, color: "#b8d1dc", fontSize: 11, fontWeight: "600" },
  messageRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 17, gap: 9 },
  messageRowUser: { flexDirection: "row-reverse" },
  avatar: { width: 29, height: 29, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  jarvisAvatar: { backgroundColor: "#67e8f9" },
  userAvatar: { backgroundColor: "#294257" },
  avatarText: { color: "#d9f9ff", fontSize: 9, fontWeight: "800" },
  messageBubble: { maxWidth: "82%", padding: 12, borderRadius: 15 },
  jarvisBubble: { borderTopLeftRadius: 5, backgroundColor: "#0c2536", borderWidth: 1, borderColor: "#1b4153" },
  userBubble: { borderTopRightRadius: 5, backgroundColor: "#15566c" },
  messageText: { color: "#d8edf1", fontSize: 13, lineHeight: 20 },
  messageTime: { marginTop: 6, color: "#6f8b9c", fontSize: 9 },
  chatFooter: { paddingTop: 7, paddingBottom: 8 },
  footerLabel: { color: "#5d7d8f", fontSize: 9, letterSpacing: 1.3, fontWeight: "800", marginBottom: 9 },
  shortcutChip: { marginRight: 8, paddingVertical: 9, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 12, borderWidth: 1, borderColor: "#1b3a4d", backgroundColor: "#0a1d2d" },
  shortcutDot: { width: 7, height: 7, borderRadius: 4 },
  shortcutText: { color: "#b8d1dc", fontSize: 11 },
  composerWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 9, borderTopWidth: 1, borderTopColor: "#183246", backgroundColor: "#091b2b" },
  composer: { minHeight: 51, flexDirection: "row", alignItems: "center", padding: 6, borderRadius: 16, borderWidth: 1, borderColor: "#254557", backgroundColor: "#0c2132" },
  composerIcon: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  composerIconActive: { backgroundColor: "#67e8f9" },
  composerInput: { flex: 1, paddingHorizontal: 8, color: "#d9f9ff", fontSize: 13 },
  sendButton: { width: 37, height: 37, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#67e8f9" },
  composerMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  speakToggle: { flexDirection: "row", alignItems: "center", gap: 5 },
  helper: { color: "#5d7d8f", fontSize: 9, lineHeight: 14 },
  page: { padding: 18, paddingBottom: 34 },
  pageTitle: { paddingTop: 10, paddingBottom: 21 },
  eyebrow: { color: "#67e8f9", fontSize: 9, letterSpacing: 1.5, fontWeight: "800" },
  pageHeading: { marginTop: 10, color: "#e1f8fb", fontSize: 25, fontWeight: "700" },
  pageSub: { marginTop: 8, color: "#7792a3", fontSize: 13, lineHeight: 19 },
  panel: { marginBottom: 14, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: "#1b3a4d", backgroundColor: "#0a1d2d" },
  panelTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: "#a9d8e3", fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  panelSub: { marginTop: 4, color: "#678496", fontSize: 11 },
  routineRow: { minHeight: 60, paddingVertical: 11, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#173547", gap: 12 },
  routineIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#102b3c" },
  appRow: { paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#173547" },
  appIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  appName: { color: "#c8e1e8", fontSize: 13, fontWeight: "700" },
  smallAdd: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#67e8f9" },
  infoBox: { padding: 13, flexDirection: "row", gap: 9, borderRadius: 14, borderWidth: 1, borderColor: "#1a5361", backgroundColor: "#0a2935" },
  infoText: { flex: 1, color: "#8fb8c3", fontSize: 11, lineHeight: 17 },
  input: { minHeight: 46, marginTop: 8, marginBottom: 10, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "#254557", backgroundColor: "#081827", color: "#d9f9ff", fontSize: 13 },
  fieldLabel: { marginTop: 8, color: "#7792a3", fontSize: 10, letterSpacing: 0.6 },
  inlineForm: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  primaryButton: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, backgroundColor: "#67e8f9" },
  primaryButtonSmall: { minHeight: 46, minWidth: 125, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 13, backgroundColor: "#67e8f9" },
  primaryButtonText: { color: "#071421", fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
  taskRow: { paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: 1, borderTopColor: "#173547" },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#477084", alignItems: "center", justifyContent: "center" },
  checkCircleDone: { borderColor: "#67e8f9", backgroundColor: "#67e8f9" },
  taskTitle: { color: "#c8e1e8", fontSize: 13, fontWeight: "600" },
  taskDone: { color: "#607d8d", textDecorationLine: "line-through" },
  empty: { paddingVertical: 18, color: "#6f8b9c", fontSize: 12, lineHeight: 18 },
  loginWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  loginOrb: { width: 68, height: 68, marginBottom: 17, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: "#67e8f9", shadowColor: "#67e8f9", shadowOpacity: 0.25, shadowRadius: 24 },
  loginTitle: { color: "#e1f8fb", fontSize: 24, letterSpacing: 5, fontWeight: "800" },
  loginSub: { marginTop: 8, color: "#5e8296", fontSize: 9, letterSpacing: 1.8 },
  loginCard: { width: "100%", maxWidth: 390, marginTop: 30, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#1b4658", backgroundColor: "#0a1d2d" },
  modalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18, backgroundColor: "rgba(1,7,13,.78)" },
  modalCard: { width: "100%", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#2b6575", backgroundColor: "#0b2030" },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
});
