// Mirrors app/src/components/DialectCard.svelte.

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../services/catalog.dart';
import '../services/i18n.dart';

class DialectCard extends StatelessWidget {
  final Dialect dialect;
  final bool selected;
  final VoidCallback? onTap;
  const DialectCard({super.key, required this.dialect, this.selected = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    final i18n = I18n.instance;
    return Material(
      color: Colors.white,
      elevation: 0,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.black12, width: 1),
          ),
          child: Stack(
            children: [
              if (dialect.cantons.length > 1)
                Positioned(
                  right: 4, top: 0, bottom: 0,
                  child: Center(child: _CantonGrid(codes: dialect.cantons)),
                )
              else if (dialect.canton.isNotEmpty)
                Positioned(
                  right: 0, top: 0, bottom: 0,
                  child: Center(
                    child: SvgPicture.asset(
                      "assets/cantons/${dialect.canton}.svg",
                      width: 56, height: 56,
                    ),
                  ),
                ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(dialect.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(i18n.t("region.${dialect.key}"),
                    style: TextStyle(color: Colors.black.withValues(alpha: 0.5), fontSize: 12)),
                  const SizedBox(height: 2),
                  Text("${dialect.speakers} ${i18n.t("unit.speakers")}",
                    style: TextStyle(color: Colors.black.withValues(alpha: 0.4), fontSize: 12)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// 3-column grid of small canton shields, used for merged regional clusters
// (Ost-/Innerschweiz). Fits into the same right-side slot a single 56px
// shield would otherwise occupy.
class _CantonGrid extends StatelessWidget {
  final List<String> codes;
  const _CantonGrid({required this.codes});

  @override
  Widget build(BuildContext context) {
    const cell = 20.0; // 3 cols × 20 + gaps ≈ 60 → matches single-shield slot
    return SizedBox(
      width: cell * 3 + 4, // 64
      child: Wrap(
        spacing: 2, runSpacing: 2,
        alignment: WrapAlignment.center,
        children: [
          for (final c in codes)
            SvgPicture.asset(
              "assets/cantons/$c.svg",
              width: cell, height: cell,
            ),
        ],
      ),
    );
  }
}
