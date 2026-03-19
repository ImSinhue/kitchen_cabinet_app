/**
 * Board Breakdown Screen — "Despiece de Tableros"
 *
 * Flow:
 *  1. idle    → user selects a PDF file via document picker
 *  2. loading → PDF is parsed (boards + pieces extracted)
 *  3. cutting → step-by-step guide per board (SVG visualisation)
 *  4. summary → final report (utilisation, waste, piece checklist)
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Rect, Text as SvgText, G } from "react-native-svg";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { parsePDFFile, type ParsedBoard, type CutPiece } from "@/lib/pdf-file-reader";
import {
  generateCutPlan,
  computeSummary,
  type CutPlan,
} from "@/lib/cut-plan-generator";

// ─── Screen State Types ───────────────────────────────────────────────────────

type ScreenPhase = "idle" | "loading" | "cutting" | "summary";

// ─── Component ───────────────────────────────────────────────────────────────

export default function BoardBreakdownScreen() {
  // ── State ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ScreenPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Boards produced by the parser (mutated via isCut flags) */
  const [boards, setBoards] = useState<ParsedBoard[]>([]);
  /** Current board index in the cutting flow */
  const [boardIdx, setBoardIdx] = useState(0);
  /** Current step index within the current board */
  const [stepIdx, setStepIdx] = useState(0);

  const cutPlan = useMemo<CutPlan | null>(
    () => (boards.length > 0 ? generateCutPlan(boards) : null),
    [boards]
  );

  // ── File Picker ──────────────────────────────────────────────────────────

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setErrorMsg("No se pudo obtener el archivo seleccionado.");
        return;
      }

      setErrorMsg(null);
      setPhase("loading");

      const parseResult = await parsePDFFile(asset.uri);

      if (parseResult.error || parseResult.boards.length === 0) {
        setErrorMsg(
          parseResult.error ?? "No se encontraron tableros en el PDF."
        );
        setPhase("idle");
        return;
      }

      setBoards(parseResult.boards);
      setBoardIdx(0);
      setStepIdx(0);
      setPhase("cutting");
    } catch (err) {
      setErrorMsg(`Error al cargar el archivo: ${String(err)}`);
      setPhase("idle");
    }
  }, []);

  // ── Cutting Flow Helpers ─────────────────────────────────────────────────

  const currentBoard = boards[boardIdx] as ParsedBoard | undefined;
  const currentPlan = cutPlan?.boardPlans[boardIdx];
  const currentStep = currentPlan?.steps[stepIdx];

  const totalStepsInBoard = currentPlan?.steps.length ?? 0;
  const isLastStepInBoard = stepIdx === totalStepsInBoard - 1;
  const isLastBoard = boardIdx === boards.length - 1;

  const markCurrentPieceCut = useCallback(() => {
    if (!currentStep) return;
    setBoards((prev) => {
      const updated = prev.map((b, bi) => {
        if (bi !== boardIdx) return b;
        return {
          ...b,
          pieces: b.pieces.map((p) =>
            p.id === currentStep.piece.id ? { ...p, isCut: true } : p
          ),
        };
      });
      return updated;
    });
  }, [boardIdx, currentStep]);

  const handleNext = useCallback(() => {
    markCurrentPieceCut();

    if (!isLastStepInBoard) {
      setStepIdx((s) => s + 1);
    } else if (!isLastBoard) {
      setBoardIdx((b) => b + 1);
      setStepIdx(0);
    } else {
      // All boards done → summary
      setPhase("summary");
    }
  }, [isLastBoard, isLastStepInBoard, markCurrentPieceCut]);

  const handlePrev = useCallback(() => {
    if (stepIdx > 0) {
      setStepIdx((s) => s - 1);
    } else if (boardIdx > 0) {
      const prevBoardPlan = cutPlan?.boardPlans[boardIdx - 1];
      setBoardIdx((b) => b - 1);
      setStepIdx((prevBoardPlan?.steps.length ?? 1) - 1);
    }
  }, [boardIdx, cutPlan, stepIdx]);

  const handleReset = useCallback(() => {
    setBoards([]);
    setBoardIdx(0);
    setStepIdx(0);
    setErrorMsg(null);
    setPhase("idle");
  }, []);

  // ── Render helpers ───────────────────────────────────────────────────────

  if (phase === "idle") {
    return <IdlePhase onPickFile={handlePickFile} errorMsg={errorMsg} />;
  }

  if (phase === "loading") {
    return <LoadingPhase />;
  }

  if (phase === "cutting" && currentBoard && currentStep) {
    return (
      <CuttingPhase
        board={currentBoard}
        boardIdx={boardIdx}
        totalBoards={boards.length}
        step={currentStep}
        stepIdx={stepIdx}
        totalSteps={totalStepsInBoard}
        onNext={handleNext}
        onPrev={handlePrev}
        canGoBack={boardIdx > 0 || stepIdx > 0}
      />
    );
  }

  if (phase === "summary") {
    const summary = computeSummary(boards);
    return <SummaryPhase summary={summary} boards={boards} onReset={handleReset} />;
  }

  // Fallback (shouldn't happen)
  return <LoadingPhase />;
}

// ─── Phase: Idle ─────────────────────────────────────────────────────────────

interface IdlePhaseProps {
  onPickFile: () => void;
  errorMsg: string | null;
}

function IdlePhase({ onPickFile, errorMsg }: IdlePhaseProps) {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4">
            <Text className="text-3xl font-bold text-foreground mb-2">
              Despiece de Tableros
            </Text>
            <Text className="text-sm text-muted">
              Carga un PDF de CutList Optimizer para obtener el plan de corte paso a paso
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)")}
            className="bg-primary rounded-full p-3 active:opacity-70"
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Illustration */}
        <View className="items-center my-10">
          <View className="bg-surface border-2 border-border rounded-3xl p-8">
            <MaterialIcons
              name="picture-as-pdf"
              size={80}
              color={colors.primary}
            />
          </View>
        </View>

        {/* Instructions */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-6">
          <Text className="text-base font-semibold text-foreground mb-3">
            ¿Cómo funciona?
          </Text>
          {[
            "Selecciona un PDF exportado desde CutList Optimizer",
            "La app detecta los tableros y piezas por colores",
            "Sigue el plan de corte paso a paso",
            "Al terminar, revisa el resumen de aprovechamiento",
          ].map((step, i) => (
            <View key={i} className="flex-row items-start gap-3 mb-2">
              <View className="bg-primary rounded-full w-6 h-6 items-center justify-center mt-0.5">
                <Text className="text-white text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-sm text-foreground flex-1">{step}</Text>
            </View>
          ))}
        </View>

        {/* Error */}
        {errorMsg && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="error-outline" size={20} color="#dc2626" />
              <Text className="text-red-700 text-sm flex-1">{errorMsg}</Text>
            </View>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={onPickFile}
          className="bg-primary rounded-2xl p-5 items-center active:opacity-70 mt-2"
        >
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="upload-file" size={28} color="white" />
            <Text className="text-white text-lg font-semibold">
              Seleccionar PDF
            </Text>
          </View>
        </TouchableOpacity>

        {/* Android note */}
        {Platform.OS === "android" && (
          <Text className="text-xs text-muted text-center mt-4">
            Se abrirá el selector de archivos de Android. Busca el PDF en tu almacenamiento o descargas.
          </Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Phase: Loading ───────────────────────────────────────────────────────────

function LoadingPhase() {
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-xl font-semibold text-foreground mt-6 mb-2">
          Analizando PDF…
        </Text>
        <Text className="text-sm text-muted text-center">
          Detectando tableros, colores y piezas. Puede tardar unos segundos.
        </Text>
      </View>
    </ScreenContainer>
  );
}

// ─── Phase: Cutting ───────────────────────────────────────────────────────────

interface CuttingPhaseProps {
  board: ParsedBoard;
  boardIdx: number;
  totalBoards: number;
  step: import("@/lib/cut-plan-generator").CutStep;
  stepIdx: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  canGoBack: boolean;
}

function CuttingPhase({
  board,
  boardIdx,
  totalBoards,
  step,
  stepIdx,
  totalSteps,
  onNext,
  onPrev,
  canGoBack,
}: CuttingPhaseProps) {
  const colors = useColors();
  const isLastStep = stepIdx === totalSteps - 1;

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Progress header */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-foreground">
            Tablero {boardIdx + 1} de {totalBoards} — Paso {stepIdx + 1}/{totalSteps}
          </Text>
          {/* Progress bar */}
          <View className="h-2 bg-border rounded-full mt-2 overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${((stepIdx + 1) / totalSteps) * 100}%` }}
            />
          </View>
        </View>

        {/* Board SVG visualisation */}
        <BoardVisualisation
          board={board}
          activePiece={step.piece}
        />

        {/* Current piece info */}
        <View className="bg-surface border border-border rounded-2xl p-4 mt-4">
          <View className="flex-row items-center gap-3 mb-3">
            <View
              className="w-5 h-5 rounded"
              style={{ backgroundColor: step.piece.color }}
            />
            <Text className="text-base font-semibold text-foreground flex-1">
              {step.piece.label
                ? `Pieza: ${step.piece.label}`
                : `Pieza ${step.boardStepNumber}`}
            </Text>
          </View>
          <Text className="text-sm text-muted">{step.instruction}</Text>
        </View>

        {/* Navigation buttons */}
        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            onPress={onPrev}
            disabled={!canGoBack}
            className={`flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl border ${
              canGoBack ? "border-primary" : "border-border opacity-40"
            }`}
          >
            <MaterialIcons
              name="arrow-back"
              size={20}
              color={canGoBack ? colors.primary : colors.muted}
            />
            <Text
              className={`font-semibold ${
                canGoBack ? "text-primary" : "text-muted"
              }`}
            >
              Anterior
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNext}
            className="flex-1 flex-row items-center justify-center gap-2 py-4 bg-primary rounded-2xl"
          >
            <MaterialIcons name="check-circle" size={20} color="white" />
            <Text className="text-white font-semibold">
              {isLastStep && boardIdx === totalBoards - 1
                ? "Finalizar"
                : isLastStep
                ? "Siguiente tablero"
                : "Siguiente"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Board piece summary */}
        <View className="bg-surface border border-border rounded-xl p-4 mt-4">
          <Text className="text-sm font-semibold text-foreground mb-2">
            Piezas del tablero ({board.pieces.length} total)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {board.pieces.map((piece, idx) => {
                const isCurrent = piece.id === step.piece.id;
                const isCut = piece.isCut;
                return (
                  <View
                    key={piece.id}
                    className={`items-center justify-center rounded-lg px-3 py-2 border ${
                      isCurrent
                        ? "border-primary bg-primary/10"
                        : isCut
                        ? "border-green-500 bg-green-50"
                        : "border-border bg-surface"
                    }`}
                  >
                    <View
                      className="w-3 h-3 rounded-sm mb-1"
                      style={{ backgroundColor: piece.color }}
                    />
                    <Text className="text-xs text-foreground">
                      {piece.label ?? `P${idx + 1}`}
                    </Text>
                    {isCut && (
                      <MaterialIcons name="check" size={10} color="#16a34a" />
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Board SVG Visualisation ──────────────────────────────────────────────────

interface BoardVisualisationProps {
  board: ParsedBoard;
  activePiece: CutPiece;
}

function BoardVisualisation({ board, activePiece }: BoardVisualisationProps) {
  const SVG_WIDTH = 340;
  const SVG_PADDING = 10;
  const available = SVG_WIDTH - 2 * SVG_PADDING;

  // Scale to fit within SVG_WIDTH
  const scale = Math.min(
    available / board.width,
    available / board.height
  );

  const scaledW = board.width * scale;
  const scaledH = board.height * scale;
  const offsetX = SVG_PADDING + (available - scaledW) / 2;
  const offsetY = SVG_PADDING;

  const svgHeight = scaledH + 2 * SVG_PADDING;

  // In PDF coords: Y grows upward. Flip for SVG (Y grows downward).
  const flipY = (y: number, h: number) =>
    board.y + board.height - y - h;

  return (
    <View
      className="bg-surface border border-border rounded-2xl overflow-hidden"
      style={{ alignSelf: "center" }}
    >
      <Svg width={SVG_WIDTH} height={Math.max(svgHeight, 100)}>
        {/* Board background */}
        <Rect
          x={offsetX}
          y={offsetY}
          width={scaledW}
          height={scaledH}
          fill="#f5f0e8"
          stroke="#8b7355"
          strokeWidth={1.5}
        />

        {/* Pieces */}
        {board.pieces.map((piece) => {
          const px = offsetX + (piece.x - board.x) * scale;
          const py =
            offsetY + flipY(piece.y, piece.height) * scale;
          const pw = piece.width * scale;
          const ph = piece.height * scale;

          const isActive = piece.id === activePiece.id;
          const isCut = piece.isCut;

          return (
            <G key={piece.id}>
              <Rect
                x={px}
                y={py}
                width={pw}
                height={ph}
                fill={isCut ? "#bbf7d0" : isActive ? piece.color : piece.color}
                fillOpacity={isCut ? 0.6 : isActive ? 1.0 : 0.35}
                stroke={isActive ? "#0a7ea4" : isCut ? "#16a34a" : "#555"}
                strokeWidth={isActive ? 2 : 0.8}
              />
              {/* Label (only if big enough) */}
              {pw > 30 && ph > 18 && (
                <SvgText
                  x={px + pw / 2}
                  y={py + ph / 2 + 4}
                  fontSize={Math.max(7, Math.min(10, pw / 4))}
                  textAnchor="middle"
                  fill={isActive ? "#0a7ea4" : "#333"}
                  fontWeight={isActive ? "bold" : "normal"}
                >
                  {piece.label
                    ? piece.label.split(" ")[0]
                    : `P${board.pieces.indexOf(piece) + 1}`}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Active piece highlight border */}
        {(() => {
          const px =
            offsetX + (activePiece.x - board.x) * scale;
          const py =
            offsetY + flipY(activePiece.y, activePiece.height) * scale;
          const pw = activePiece.width * scale;
          const ph = activePiece.height * scale;
          return (
            <Rect
              x={px - 1}
              y={py - 1}
              width={pw + 2}
              height={ph + 2}
              fill="none"
              stroke="#0a7ea4"
              strokeWidth={2.5}
              strokeDasharray="4 2"
            />
          );
        })()}
      </Svg>
    </View>
  );
}

// ─── Phase: Summary ───────────────────────────────────────────────────────────

interface SummaryPhaseProps {
  summary: import("@/lib/cut-plan-generator").CutSummary;
  boards: ParsedBoard[];
  onReset: () => void;
}

function SummaryPhase({ summary, boards, onReset }: SummaryPhaseProps) {
  const colors = useColors();

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="items-center mb-6">
          <View className="bg-green-100 rounded-full p-4 mb-3">
            <MaterialIcons name="check-circle" size={48} color="#16a34a" />
          </View>
          <Text className="text-2xl font-bold text-foreground">
            ¡Corte completado!
          </Text>
          <Text className="text-sm text-muted mt-1">
            Resumen del despiece
          </Text>
        </View>

        {/* Stats cards */}
        <View className="flex-row gap-3 mb-4">
          <StatCard
            label="Tableros"
            value={String(summary.totalBoards)}
            icon="layers"
            color="#0a7ea4"
          />
          <StatCard
            label="Piezas"
            value={String(summary.totalPieces)}
            icon="dashboard"
            color="#8b5cf6"
          />
        </View>
        <View className="flex-row gap-3 mb-6">
          <StatCard
            label="Aprovechamiento"
            value={`${summary.averageUtilizationPercent}%`}
            icon="pie-chart"
            color="#16a34a"
          />
          <StatCard
            label="Merma"
            value={`${summary.wastePercent}%`}
            icon="delete-outline"
            color="#f59e0b"
          />
        </View>

        {/* Per-board breakdown */}
        <Text className="text-base font-semibold text-foreground mb-3">
          Detalle por tablero
        </Text>
        {summary.perBoard.map((b, idx) => (
          <View
            key={b.boardId}
            className="bg-surface border border-border rounded-xl p-4 mb-3"
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold text-foreground">
                Tablero {idx + 1}
              </Text>
              <Text className="text-sm text-muted">
                Página {b.pageNumber}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-muted">
                Piezas cortadas: {b.cutPieces}/{b.totalPieces}
              </Text>
              <Text className="text-sm text-primary font-semibold">
                {b.utilizationPercent}% uso
              </Text>
            </View>
            {/* Mini progress bar */}
            <View className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${b.utilizationPercent}%` }}
              />
            </View>
          </View>
        ))}

        {/* Piece checklist */}
        <Text className="text-base font-semibold text-foreground mb-3">
          Lista de piezas cortadas
        </Text>
        {boards.map((board, bi) =>
          board.pieces.map((piece, pi) => (
            <View
              key={piece.id}
              className={`flex-row items-center gap-3 py-3 border-b border-border/50 ${
                piece.isCut ? "opacity-100" : "opacity-60"
              }`}
            >
              <View
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: piece.color }}
              />
              <Text className="text-sm text-foreground flex-1">
                {piece.label
                  ? piece.label
                  : `Pieza ${pi + 1} (tablero ${bi + 1})`}
              </Text>
              <MaterialIcons
                name={piece.isCut ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={piece.isCut ? "#16a34a" : colors.muted}
              />
            </View>
          ))
        )}

        {/* New PDF button */}
        <TouchableOpacity
          onPress={onReset}
          className="bg-primary rounded-2xl p-4 items-center mt-6 mb-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="upload-file" size={22} color="white" />
            <Text className="text-white font-semibold text-base">
              Cargar nuevo PDF
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <View className="flex-1 bg-surface border border-border rounded-xl p-4">
      <View
        className="rounded-full p-2 self-start mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
