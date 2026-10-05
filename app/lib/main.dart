// Voidling for Android: runs the web game (bundled in assets/game, built by tools/build.mjs)
// full screen in a WebView, so it plays offline.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';

const voidColor = Color(0xFF0B0518);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  WakelockPlus.enable(); // keep the screen on while playing
  runApp(const VoidlingApp());
}

class VoidlingApp extends StatelessWidget {
  const VoidlingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Voidling',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(scaffoldBackgroundColor: voidColor),
      home: const GameScreen(),
    );
  }
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with WidgetsBindingObserver {
  late final WebViewController _web;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(voidColor)
      ..loadFlutterAsset('assets/game/index.html');
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Pause the game when the app leaves the screen; restore full screen when it comes back
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      _web.runJavaScript('window.V && V.G && V.G.pause && V.G.pause()');
    } else if (state == AppLifecycleState.resumed) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  // Back button: the game decides (closes the shop, or pauses a running game); when it has
  // nothing to close it answers 'exit' and the app closes
  Future<void> _onBack() async {
    final result = await _web.runJavaScriptReturningResult(
        "(window.V && V.G && V.G.back) ? V.G.back() : 'exit'");
    if (!result.toString().contains('handled')) await SystemNavigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: Scaffold(body: WebViewWidget(controller: _web)),
    );
  }
}
