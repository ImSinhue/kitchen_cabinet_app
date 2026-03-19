/**
 * Despiece de Tableros — Board Breakdown Screen
 *
 * Allows users to:
 *  1. Pick a CutList Optimizer PDF from the device (expo-document-picker).
 *  2. Parse it and display detected boards/pieces.
 *  3. Navigate through a step-by-step cut sequence.
 *  4. View a summary (utilisation, piece count) at the end.
 *
 * Android-first (works on web with graceful degradation).
 */

import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { parsePDFFile } from "@/lib/pdf/parse-pdf-file";
import { generateCutPlan } from "@/lib/pdf/cut-plan";
import type { BoardCutPlan } from "@/lib/pdf/cut-plan";
import type { ParseResult } from "@/lib/pdf/cutlist-pdf-parser";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_PREVIEW_WIDTH = 320; // px — fixed preview width

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScreenMode = "idle" | "loading" | "steps" | "summary";

// ---------------------------------------------------------------------------
// Board preview (SVG)
// ---------------------------------------------------------------------------

interface BoardPreviewProps {
  plan: BoardCutPlan;
  /** Index of the current cut step (-1 = show all) */
  currentStep: number;
}

function BoardPreview({ plan, currentStep }: BoardPreviewProps) {
  const scale = BOARD_PREVIEW_WIDTH / plan.sheetWidth;
  const svgHeight = plan.sheetHeight * scale;

  const completedPieceIndices = new Set<number>();
  for (let i = 0; i <= currentStep; i++) {
    const step = plan.steps[i];
    if (step) {
      for (const idx of step.piecesCompleted) completedPieceIndices.add(idx);
    }
  }

  const cutLine =
    currentStep >= 0 && currentStep < plan.steps.length
      ? plan.steps[currentStep]?.cutLine
      : undefined;

  return (
    <View style={{ alignSelf: "center", borderWidth: 1, borderColor: "#ccc" }}>
      <Svg width={BOARD_PREVIEW_WIDTH} height={svgHeight}>
        {/* Background */}
        <Rect x={0} y={0} width={BOARD_PREVIEW_WIDTH} height={svgHeight} fill="#f5f0e8" />

        {/* Pieces */}
        {plan.pieces.map((piece) => {
          const px = piece.x * scale;
          // PDF origin is bottom-left; SVG origin is top-left — flip Y
          const py = svgHeight - (piece.y + piece.height) * scale;
          const pw = piece.width * scale;
          const ph = piece.height * scale;
          const isDone = completedPieceIndices.has(piece.pieceIndex);

          return (
            <Svg key={piece.pieceIndex} x={px} y={py} width={pw} height={ph}>
              <Rect
                x={0}
                y={0}
                width={pw}
                height={ph}
                fill={piece.color}
                fillOpacity={isDone ? 0.4 : 0.85}
                stroke="#555"
                strokeWidth={0.5}
              />
              {pw > 20 && ph > 12 && (
                <SvgText
                  x={pw / 2}
                  y={ph / 2 + 4}
                  fontSize={Math.max(6, Math.min(10, pw / 8))}
                  textAnchor="middle"
                  fill="#222"
                >
                  {piece.label ??
                    `${Math.round(piece.width)}×${Math.round(piece.height)}`}
                </SvgText>
              )}
            </Svg>
          );
        })}

        {/* Current cut line */}
        {cutLine && (
          <Line
            x1={
              cutLine.direction === "V"
                ? cutLine.position * scale
                : cutLine.rangeStart * scale
            }
            y1={
              cutLine.direction === "H"
                ? svgHeight - cutLine.position * scale
                : cutLine.rangeStart * scale
            }
            x2={
              cutLine.direction === "V"
                ? cutLine.position * scale
                : cutLine.rangeEnd * scale
            }
            y2={
              cutLine.direction === "H"
                ? svgHeight - cutLine.position * scale
                : cutLine.rangeEnd * scale
            }
            stroke="#e74c3c"
            strokeWidth={2}
            strokeDasharray="6,3"
          />
        )}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Summary screen
// ---------------------------------------------------------------------------

interface SummaryViewProps {
  plan: ReturnType<typeof generateCutPlan>;
  onReset: () => void;
}

function SummaryView({ plan, onReset }: SummaryViewProps) {
  const colors = useColors();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text className="text-2xl font-bold text-foreground">
        Resumen de Corte
      </Text>

      {/* Global stats */}
      <View className="bg-surface border border-border rounded-xl p-4 gap-2">
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">Tableros procesados</Text>
          <Text className="text-foreground font-semibold">
            {plan.boards.length}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">Piezas totales</Text>
          <Text className="text-foreground font-semibold">
            {plan.totalPieces}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">Aprovechamiento medio</Text>
          <Text className="text-foreground font-semibold">
            {plan.averageUtilization.toFixed(1)} %
          </Text>
        </View>
      </View>

      {/* Per-board summary */}
      {plan.boards.map((board) => (
        <View
          key={board.boardIndex}
          className="bg-surface border border-border rounded-xl p-4 gap-2"
        >
          <Text className="text-foreground font-semibold">
            Tablero {board.boardIndex + 1} —{" "}
            {board.sheetWidth.toFixed(0)} × {board.sheetHeight.toFixed(0)} mm
          </Text>
          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">Piezas</Text>
            <Text className="text-foreground">{board.pieces.length}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">Pasos de corte</Text>
            <Text className="text-foreground">{board.steps.length}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted text-sm">Aprovechamiento</Text>
            <Text
              style={{
                color:
                  board.utilizationPercent >= 70
                    ? "#27ae60"
                    : board.utilizationPercent >= 40
                    ? "#f39c12"
                    : colors.error,
                fontWeight: "600",
              }}
            >
              {board.utilizationPercent.toFixed(1)} %
            </Text>
          </View>

          {/* Piece list */}
          {board.pieces.length > 0 && (
            <View className="mt-2 gap-1">
              <Text className="text-xs text-muted font-semibold uppercase">
                Piezas
              </Text>
              {board.pieces.map((p) => (
                <View
                  key={p.pieceIndex}
                  className="flex-row items-center gap-2"
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: p.color,
                      borderWidth: 1,
                      borderColor: "#aaa",
                    }}
                  />
                  <Text className="text-sm text-foreground flex-1">
                    {p.label ?? `Pieza ${p.pieceIndex + 1}`}
                  </Text>
                  <Text className="text-xs text-muted">
                    {p.width.toFixed(0)} × {p.height.toFixed(0)} mm
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity
        onPress={onReset}
        className="bg-primary rounded-xl p-4 mt-2 active:opacity-70"
      >
        <Text className="text-white font-semibold text-center">
          Analizar otro PDF
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step navigator
// ---------------------------------------------------------------------------

interface StepViewProps {
  plan: ReturnType<typeof generateCutPlan>;
  onFinish: () => void;
}

function StepView({ plan, onFinish }: StepViewProps) {
  const [boardIdx, setBoardIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(-1); // -1 = overview before first cut
  const colors = useColors();

  const board = plan.boards[boardIdx];
  if (!board) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-muted">Sin tableros</Text>
      </View>
    );
  }

  const totalSteps = board.steps.length;
  const isOverview = stepIdx < 0;
  const isLastStep = stepIdx >= totalSteps - 1;
  const isLastBoard = boardIdx >= plan.boards.length - 1;

  const currentStep = board.steps[stepIdx];
  const completedOnThisStep = currentStep?.piecesCompleted ?? [];

  const handleNext = () => {
    if (isLastStep) {
      if (!isLastBoard) {
        setBoardIdx((b) => b + 1);
        setStepIdx(-1);
      } else {
        onFinish();
      }
    } else {
      setStepIdx((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (stepIdx > -1) {
      setStepIdx((s) => s - 1);
    } else if (boardIdx > 0) {
      setBoardIdx((b) => b - 1);
      const prev = plan.boards[boardIdx - 1];
      setStepIdx(prev ? prev.steps.length - 1 : -1);
    }
  };

  const canGoBack = boardIdx > 0 || stepIdx > -1;

  return (
    <View className="flex-1">
      {/* Board tabs */}
      {plan.boards.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-border"
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          {plan.boards.map((b, i) => (
            <TouchableOpacity
              key={b.boardIndex}
              onPress={() => {
                setBoardIdx(i);
                setStepIdx(-1);
              }}
              className={`mr-2 px-3 py-1 rounded-full border ${
                i === boardIdx
                  ? "bg-primary border-primary"
                  : "border-border bg-surface"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  i === boardIdx ? "text-white" : "text-foreground"
                }`}
              >
                Tablero {b.boardIndex + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {/* Status bar */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm text-muted">
            {isOverview
              ? "Vista general"
              : `Paso ${stepIdx + 1} / ${totalSteps}`}
          </Text>
          <Text className="text-sm text-muted">
            {board.sheetWidth.toFixed(0)} × {board.sheetHeight.toFixed(0)} mm
          </Text>
        </View>

        {/* Board preview */}
        {board.pieces.length > 0 ? (
          <BoardPreview plan={board} currentStep={stepIdx} />
        ) : board.jpegBytes ? (
          <View
            className="bg-surface border border-border rounded-xl items-center justify-center"
            style={{ height: 200 }}
          >
            <MaterialIcons name="image" size={48} color={colors.muted} />
            <Text className="text-muted text-sm mt-2">
              PDF rasterizado — vista previa no disponible
            </Text>
            <Text className="text-xs text-muted mt-1">
              {board.sheetWidth.toFixed(0)} × {board.sheetHeight.toFixed(0)} mm
            </Text>
          </View>
        ) : (
          <View
            className="bg-surface border border-border rounded-xl items-center justify-center"
            style={{ height: 120 }}
          >
            <Text className="text-muted">Sin piezas en este tablero</Text>
          </View>
        )}

        {/* Step description */}
        {!isOverview && currentStep && (
          <View className="mt-4 bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground font-semibold mb-1">
              Paso {stepIdx + 1}
            </Text>
            <Text className="text-muted text-sm">{currentStep.description}</Text>
            {completedOnThisStep.length > 0 && (
              <View className="mt-2">
                <Text className="text-xs text-muted font-semibold uppercase">
                  Piezas liberadas en este paso
                </Text>
                {completedOnThisStep.map((idx) => {
                  const piece = board.pieces.find((p) => p.pieceIndex === idx);
                  return (
                    <View key={idx} className="flex-row items-center gap-2 mt-1">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          backgroundColor: piece?.color ?? "#888",
                          borderWidth: 0.5,
                          borderColor: "#666",
                        }}
                      />
                      <Text className="text-sm text-foreground">
                        {piece?.label ??
                          `${piece?.width.toFixed(0) ?? "?"} × ${piece?.height.toFixed(0) ?? "?"} mm`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {isOverview && (
          <View className="mt-4 bg-surface border border-border rounded-xl p-4">
            <Text className="text-foreground font-semibold mb-1">
              Tablero {boardIdx + 1}
            </Text>
            <Text className="text-muted text-sm">
              {board.pieces.length} pieza{board.pieces.length !== 1 ? "s" : ""} •{" "}
              {totalSteps} paso{totalSteps !== 1 ? "s" : ""} de corte
            </Text>
            <Text className="text-muted text-sm mt-1">
              Aprovechamiento: {board.utilizationPercent.toFixed(1)} %
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View
        className="flex-row gap-3 px-4 pb-4 pt-2 border-t border-border bg-background"
        style={{ paddingBottom: Platform.OS === "ios" ? 24 : 16 }}
      >
        <TouchableOpacity
          onPress={handlePrev}
          disabled={!canGoBack}
          className={`flex-1 border rounded-xl py-3 items-center ${
            canGoBack ? "border-primary" : "border-border opacity-40"
          }`}
        >
          <Text
            className={`font-semibold ${canGoBack ? "text-primary" : "text-muted"}`}
          >
            ← Anterior
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          className="flex-1 bg-primary rounded-xl py-3 items-center active:opacity-70"
        >
          <Text className="text-white font-semibold">
            {isLastStep && isLastBoard
              ? "Ver Resumen"
              : isLastStep
              ? "Siguiente tablero →"
              : isOverview
              ? "Empezar →"
              : "Siguiente →"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function BoardBreakdownScreen() {
  const router = useRouter();
  const colors = useColors();

  const [mode, setMode] = useState<ScreenMode>("idle");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [cutPlan, setCutPlan] = useState<ReturnType<
    typeof generateCutPlan
  > | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const reset = useCallback(() => {
    setMode("idle");
    setParseResult(null);
    setCutPlan(null);
    setFileName("");
    setWarnings([]);
  }, []);

  const handlePickPDF = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      setFileName(asset.name ?? "archivo.pdf");
      setMode("loading");
      setWarnings([]);

      try {
        const parsed = await parsePDFFile(asset.uri);
        setParseResult(parsed);

        if (parsed.warnings.length > 0) {
          setWarnings(parsed.warnings);
        }

        if (parsed.boards.length === 0) {
          Alert.alert(
            "Sin datos",
            "No se detectaron tableros en el PDF.\n\n" +
              (parsed.warnings.join("\n") ||
                "Comprueba que el PDF es un CutList Optimizer exportado como vector."),
          );
          setMode("idle");
          return;
        }

        const plan = generateCutPlan(parsed.boards);
        setCutPlan(plan);
        setMode("steps");
      } catch (parseError) {
        console.error("[BoardBreakdown] parse error:", parseError);
        Alert.alert(
          "Error al analizar",
          `No se pudo procesar el PDF:\n${String(parseError)}\n\n` +
            "Asegúrate de que es un PDF vectorial de CutList Optimizer.",
        );
        setMode("idle");
      }
    } catch (pickerError) {
      console.error("[BoardBreakdown] picker error:", pickerError);
      Alert.alert("Error", `No se pudo abrir el selector de archivos:\n${String(pickerError)}`);
      setMode("idle");
    }
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (mode === "loading") {
    return (
      <ScreenContainer className="items-center justify-center gap-4">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted text-sm">Analizando PDF…</Text>
        {fileName ? (
          <Text className="text-xs text-muted">{fileName}</Text>
        ) : null}
      </ScreenContainer>
    );
  }

  // ── Steps ────────────────────────────────────────────────────────────────
  if (mode === "steps" && cutPlan) {
    return (
      <ScreenContainer className="p-0">
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
          <TouchableOpacity
            onPress={reset}
            className="bg-surface border border-border rounded-full p-2 active:opacity-70"
          >
            <MaterialIcons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {fileName}
            </Text>
            <Text className="text-xs text-muted">
              {cutPlan.boards.length} tablero{cutPlan.boards.length !== 1 ? "s" : ""} •{" "}
              {cutPlan.totalPieces} pieza{cutPlan.totalPieces !== 1 ? "s" : ""}
            </Text>
          </View>
          {parseResult?.mode === "raster" && (
            <View className="bg-yellow-100 px-2 py-0.5 rounded">
              <Text className="text-yellow-700 text-xs">PDF rasterizado</Text>
            </View>
          )}
        </View>

        {warnings.length > 0 && (
          <View className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
            {warnings.map((w, i) => (
              <Text key={i} className="text-xs text-yellow-700">
                ⚠ {w}
              </Text>
            ))}
          </View>
        )}

        <StepView plan={cutPlan} onFinish={() => setMode("summary")} />
      </ScreenContainer>
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  if (mode === "summary" && cutPlan) {
    return (
      <ScreenContainer className="p-0">
        <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
          <TouchableOpacity
            onPress={() => setMode("steps")}
            className="bg-surface border border-border rounded-full p-2 active:opacity-70"
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-foreground">
            Resumen final
          </Text>
        </View>
        <SummaryView plan={cutPlan} onReset={reset} />
      </ScreenContainer>
    );
  }

  // ── Idle (file picker) ───────────────────────────────────────────────────
  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4">
            <Text className="text-3xl font-bold text-foreground mb-1">
              Despiece de Tableros
            </Text>
            <Text className="text-sm text-muted">
              Importa un PDF de CutList Optimizer y sigue el plan de corte
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)")}
            className="bg-primary rounded-full p-3 active:opacity-70"
            style={{ flexShrink: 0 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Upload card */}
        <TouchableOpacity
          onPress={handlePickPDF}
          className="bg-surface border-2 border-dashed border-primary rounded-2xl p-8 items-center gap-4 active:opacity-70"
        >
          <View className="bg-primary rounded-full p-4">
            <MaterialIcons name="picture-as-pdf" size={40} color="white" />
          </View>
          <Text className="text-xl font-semibold text-foreground">
            Seleccionar PDF
          </Text>
          <Text className="text-sm text-muted text-center">
            Exporta tu proyecto desde CutList Optimizer y selecciona el PDF aquí
          </Text>
          <View className="bg-primary rounded-xl px-6 py-3 mt-2">
            <Text className="text-white font-semibold">Abrir archivo</Text>
          </View>
        </TouchableOpacity>

        {/* Info cards */}
        <View className="mt-8 gap-3">
          <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
            ¿Qué incluye?
          </Text>
          {[
            {
              icon: "grid-on" as const,
              title: "Detección de piezas",
              desc: "Detecta tableros y piezas coloreadas del PDF",
            },
            {
              icon: "content-cut" as const,
              title: "Plan de corte paso a paso",
              desc: "Guía secuencial de cortes guillotina",
            },
            {
              icon: "bar-chart" as const,
              title: "Resumen de aprovechamiento",
              desc: "Porcentaje de uso del material por tablero",
            },
          ].map((item) => (
            <View
              key={item.icon}
              className="bg-surface border border-border rounded-xl p-4 flex-row items-center gap-4"
            >
              <View className="bg-primary rounded-lg p-2">
                <MaterialIcons name={item.icon} size={22} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {item.title}
                </Text>
                <Text className="text-xs text-muted mt-0.5">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
