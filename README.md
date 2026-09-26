# J.A.R.V.I.S. Mobile Command

Aplicativo Android Expo/React Native separado do JARVIS Web. O projeto não altera o frontend web; a sincronização acontece pelo backend do site e pelo mesmo banco de dados.

## O que já está implementado

- Interface mobile futurista com três áreas: **Assistente**, **Rotinas** e **Agenda**.
- Login mobile com token Bearer armazenado em `expo-secure-store`.
- Sincronização com o JARVIS Web para histórico, tarefas e automações.
- Comandos por texto e reconhecimento de voz nativo com `expo-speech-recognition`.
- Abertura de aplicativos por esquema Android (`youtube://`, `googlegmail://`, etc.).
- Cadastro de novos atalhos de aplicativos.
- Abertura dos painéis nativos de Wi‑Fi e Bluetooth.
- Lembretes com notificações locais mesmo com o app fechado.
- Tarefas compartilhadas com o banco do JARVIS Web.
- Rotinas de conectividade registradas no endpoint de automações do Web.
- Fallback local: mensagens, atalhos e lembretes continuam disponíveis sem conexão.

## Validação realizada

```bash
npx tsc --noEmit
npx expo export --platform android
```

Ambos passam no projeto atual. O bundle Android é exportado para `dist/`.

## Gerar um APK instalável

O sandbox não possui Android SDK/Gradle nem credencial Expo para executar o build remoto automaticamente. Com uma conta Expo configurada:

```bash
npm install
npx eas login
npx eas build --platform android --profile preview
```

O perfil `preview` está configurado para produzir um `.apk` instalável. Para a Play Store, use:

```bash
npx eas build --platform android --profile production
```

## Integração com o JARVIS Web

O aplicativo aponta para o backend do JARVIS Web pela variável `EXPO_PUBLIC_JARVIS_WEB_URL`. O endpoint de login recebe `mobile: true` e retorna um token Bearer. As rotas de histórico, tarefas e automações existentes aceitam esse token; o login web por cookie continua funcionando normalmente.

Para usar outra implantação:

```bash
EXPO_PUBLIC_JARVIS_WEB_URL=https://seu-dominio.example npx eas build --platform android --profile preview
```

## Limitações atuais do Android

- Android exige confirmação do sistema para alterações sensíveis de Wi‑Fi e Bluetooth; o app abre os painéis oficiais em vez de tentar contornar essa proteção.
- Abrir um aplicativo depende do esquema Android disponível. A próxima evolução pode usar um módulo nativo de descoberta de pacotes/intents para listar automaticamente os apps instalados.
- A voz exige um development build ou APK gerado pelo EAS, pois `expo-speech-recognition` é um módulo nativo e não funciona integralmente no Expo Go.
