// Mirrors app/src/components/Wordmark.svelte.

import 'package:flutter/material.dart';

class Wordmark extends StatelessWidget {
  final double fontSize;
  const Wordmark({super.key, this.fontSize = 18});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Swiss flag glyph
        Container(
          width: 22, height: 22,
          decoration: BoxDecoration(
            color: const Color(0xFFda291c),
            borderRadius: BorderRadius.circular(3),
          ),
          child: CustomPaint(painter: _SwissCross()),
        ),
        const SizedBox(width: 8),
        Text("rede.chat",
          style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
      ],
    );
  }
}

class _SwissCross extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.white;
    final w = size.width, h = size.height;
    // Vertical bar
    canvas.drawRect(Rect.fromLTWH(w * 13/32, h * 6/32, w * 6/32, h * 20/32), p);
    // Horizontal bar
    canvas.drawRect(Rect.fromLTWH(w * 6/32, h * 13/32, w * 20/32, h * 6/32), p);
  }
  @override
  bool shouldRepaint(CustomPainter old) => false;
}
