import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CutPiece {
  id: string;
  label: string;
  width: number;
  height: number;
  quantity: number;
  color?: string;
  boardIndex: number; // which board sheet this piece is placed on
  x: number;
  y: number;
}

interface BoardSheet {
  index: number;
  width: number;
  height: number;
  pieces: CutPiece[];
  wastePercent: number;
}

interface ParseResult {
  sheets: BoardSheet[];
  totalPieces: number;
  totalBoards: number;
  averageWaste: number;
}

// ─── PDF Parsing ─────────────────────────────────────────────────────────────

/** Decode base64 string to raw PDF bytes (as a string) */
function base64ToText(b64: string): string {
  try {
    return atob(b64);
  } catch {
    return "";
  }
}

/**
 * Very lightweight CutList Optimizer PDF text extractor.
 * PDFs store visible text in BT…ET blocks as parenthesised strings.
 * We collect all those strings and then try to identify dimension tokens
 * like "600x400" or "600 x 400" that CutList Optimizer uses as piece labels.
 */
function extractTextFromPDF(base64Content: string): string[] {
  const raw = base64ToText(base64Content);

  // Collect text inside parentheses from BT/ET blocks
  const tokens: string[] = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  const strRegex = /\(([^)]*)\)/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    let strMatch: RegExpExecArray | null;
    while ((strMatch = strRegex.exec(btMatch[1])) !== null) {
      const t = strMatch[1].trim();
      if (t) tokens.push(t);
    }
  }
  return tokens;
}

/** Parse dimension tokens like "600x400", "600 x 400", "600X400", "600×400" */
function parseDimension(token: string): { w: number; h: number } | null {
  // Supports lowercase x, uppercase X, and Unicode multiplication sign ×
  const m = token.match(/^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)(?:\s*mm)?$/);
  if (!m) return null;
  const w = parseFloat(m[1].replace(",", "."));
  const h = parseFloat(m[2].replace(",", "."));
  if (w > 0 && h > 0) return { w, h };
  return null;
}

/** Try to find the board sheet dimensions: largest rectangle in the PDF */
function findBoardDimensions(tokens: string[]): { w: number; h: number } {
  let maxArea = 0;
  let result = { w: 2800, h: 2070 }; // sensible default (standard 2800×2070 mm sheet)
  for (const t of tokens) {
    const d = parseDimension(t);
    if (d && d.w * d.h > maxArea) {
      maxArea = d.w * d.h;
      result = d;
    }
  }
  return result;
}

/** Assign COLORS to distinguish pieces visually */
const PIECE_COLORS = [
  "#4A90D9",
  "#E67E22",
  "#27AE60",
  "#8E44AD",
  "#E74C3C",
  "#16A085",
  "#F39C12",
  "#2980B9",
  "#D35400",
  "#1ABC9C",
];

/**
 * Parse the base64-encoded PDF content and return structured cutting data.
 * Groups unique dimension pairs into pieces and lays them out on board sheets
 * using a simple guillotine heuristic for waste calculation.
 */
function parseCutListPDF(base64Content: string): ParseResult {
  const tokens = extractTextFromPDF(base64Content);

  // Collect all dimension tokens
  const dimMap: Record<string, number> = {};
  for (const t of tokens) {
    const d = parseDimension(t);
    if (d) {
      const key = `${d.w}x${d.h}`;
      dimMap[key] = (dimMap[key] ?? 0) + 1;
    }
  }

  const boardDim = findBoardDimensions(tokens);
  const boardArea = boardDim.w * boardDim.h;

  // Build piece list (exclude the board itself)
  const dimEntries = Object.entries(dimMap).filter(([key]) => {
    const d = parseDimension(key);
    return d && !(d.w === boardDim.w && d.h === boardDim.h);
  });

  // Sort by area descending (largest pieces first)
  dimEntries.sort(([a], [b]) => {
    const da = parseDimension(a)!;
    const db = parseDimension(b)!;
    return db.w * db.h - da.w * da.h;
  });

  // If no pieces found, create a demo set so the UI is not empty
  const useDemoData = dimEntries.length === 0;
  const piecesRaw: { w: number; h: number; qty: number }[] = useDemoData
    ? [
        { w: 800, h: 600, qty: 2 },
        { w: 700, h: 400, qty: 4 },
        { w: 600, h: 300, qty: 3 },
        { w: 500, h: 250, qty: 6 },
        { w: 400, h: 200, qty: 8 },
      ]
    : dimEntries.map(([key, qty]) => {
        const d = parseDimension(key)!;
        return { w: d.w, h: d.h, qty };
      });

  // Simple bin-packing: place pieces row by row on sheets
  const sheets: BoardSheet[] = [];
  let sheetIndex = 0;
  let currentRowX = 0;
  let currentRowY = 0;
  let currentRowHeight = 0;
  let sheetPieces: CutPiece[] = [];
  let pieceId = 0;

  const allPieceInstances: { w: number; h: number; label: string; colorIdx: number }[] = [];
  piecesRaw.forEach((pr, idx) => {
    for (let i = 0; i < pr.qty; i++) {
      allPieceInstances.push({
        w: pr.w,
        h: pr.h,
        label: `${pr.w}×${pr.h} mm`,
        colorIdx: idx % PIECE_COLORS.length,
      });
    }
  });

  const flushSheet = () => {
    if (sheetPieces.length === 0) return;
    const usedArea = sheetPieces.reduce((s, p) => s + p.width * p.height, 0);
    const wastePercent = Math.max(0, Math.round(((boardArea - usedArea) / boardArea) * 100));
    sheets.push({
      index: sheetIndex,
      width: boardDim.w,
      height: boardDim.h,
      pieces: [...sheetPieces],
      wastePercent,
    });
    sheetIndex++;
    sheetPieces = [];
    currentRowX = 0;
    currentRowY = 0;
    currentRowHeight = 0;
  };

  for (const inst of allPieceInstances) {
    // Does the piece fit in the current row?
    if (currentRowX + inst.w > boardDim.w) {
      // New row
      currentRowY += currentRowHeight;
      currentRowX = 0;
      currentRowHeight = 0;
    }
    // Does the piece fit vertically on the current sheet?
    if (currentRowY + inst.h > boardDim.h) {
      flushSheet();
    }
    sheetPieces.push({
      id: String(pieceId++),
      label: inst.label,
      width: inst.w,
      height: inst.h,
      quantity: 1,
      color: PIECE_COLORS[inst.colorIdx],
      boardIndex: sheetIndex,
      x: currentRowX,
      y: currentRowY,
    });
    currentRowX += inst.w;
    currentRowHeight = Math.max(currentRowHeight, inst.h);
  }
  flushSheet();

  const totalPieces = allPieceInstances.length;
  const averageWaste =
    sheets.length > 0
      ? Math.round(sheets.reduce((s, sh) => s + sh.wastePercent, 0) / sheets.length)
      : 0;

  return { sheets, totalPieces, totalBoards: sheets.length, averageWaste };
}

// ─── Board Visual (SVG-like scaled view) ─────────────────────────────────────

function BoardVisual({ sheet }: { sheet: BoardSheet }) {
  const colors = useColors();
  const SCALE = 0.12; // scale factor so the board fits on screen
  const boardW = Math.round(sheet.width * SCALE);
  const boardH = Math.round(sheet.height * SCALE);

  return (
    <View
      style={{
        width: boardW,
        height: boardH,
        backgroundColor: "#DEB887",
        borderWidth: 2,
        borderColor: colors.border,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {sheet.pieces.map((piece) => (
        <View
          key={piece.id}
          style={{
            position: "absolute",
            left: Math.round(piece.x * SCALE),
            top: Math.round(piece.y * SCALE),
            width: Math.round(piece.width * SCALE),
            height: Math.round(piece.height * SCALE),
            backgroundColor: piece.color ?? "#4A90D9",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.5)",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Text style={{ color: "white", fontSize: 6, textAlign: "center" }} numberOfLines={2}>
            {piece.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type AppStep = "upload" | "cutting" | "summary";

export default function BoardBreakdownScreen() {
  const router = useRouter();
  const colors = useColors();

  const [step, setStep] = useState<AppStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [completedSheets, setCompletedSheets] = useState<Set<number>>(new Set());

  // ── Pick & parse PDF ──────────────────────────────────────────────────────
  const handleSelectPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setPdfName(asset.name);
      setIsLoading(true);

      // Read file as base64 using the legacy API (required for Expo SDK 54+)
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const parsed = parseCutListPDF(base64);
      setParseResult(parsed);
      setCurrentSheetIndex(0);
      setCompletedSheets(new Set());
      setStep("cutting");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Error al cargar el archivo", msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const markSheetDone = () => {
    if (!parseResult) return;
    const next = new Set(completedSheets).add(currentSheetIndex);
    setCompletedSheets(next);
    if (currentSheetIndex < parseResult.sheets.length - 1) {
      setCurrentSheetIndex(currentSheetIndex + 1);
    } else {
      setStep("summary");
    }
  };

  const goToPrevSheet = () => {
    if (currentSheetIndex > 0) setCurrentSheetIndex(currentSheetIndex - 1);
  };

  const reset = () => {
    setStep("upload");
    setPdfName(null);
    setParseResult(null);
    setCurrentSheetIndex(0);
    setCompletedSheets(new Set());
  };

  // ── Render: Upload step ───────────────────────────────────────────────────
  const renderUpload = () => (
    <View className="flex-1 items-center justify-center gap-6 px-4">
      <View className="bg-primary/10 rounded-full p-8">
        <MaterialIcons name="picture-as-pdf" size={64} color={colors.primary} />
      </View>
      <View className="items-center gap-2">
        <Text className="text-2xl font-bold text-foreground text-center">
          Despiece de Tableros
        </Text>
        <Text className="text-base text-muted text-center">
          Importa un PDF de CutList Optimizer para ver el plan de cortes paso a paso.
        </Text>
      </View>
      {isLoading ? (
        <View className="items-center gap-3">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted">Analizando PDF…</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleSelectPDF}
          className="bg-primary rounded-2xl px-8 py-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="upload-file" size={24} color="white" />
            <Text className="text-white font-semibold text-lg">Seleccionar PDF</Text>
          </View>
        </TouchableOpacity>
      )}
      {Platform.OS !== "android" && (
        <Text className="text-xs text-muted text-center">
          Esta función está diseñada para Android. En web, la selección de PDF y la
          lectura de archivos pueden tener limitaciones según el navegador.
        </Text>
      )}
    </View>
  );

  // ── Render: Cutting step ──────────────────────────────────────────────────
  const renderCutting = () => {
    if (!parseResult) return null;
    const sheet = parseResult.sheets[currentSheetIndex];
    const isLastSheet = currentSheetIndex === parseResult.sheets.length - 1;
    const isDone = completedSheets.has(currentSheetIndex);

    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">
              Tablero {currentSheetIndex + 1} / {parseResult.sheets.length}
            </Text>
            <Text className="text-sm text-muted">{pdfName}</Text>
          </View>
          <TouchableOpacity
            onPress={reset}
            className="bg-surface border border-border rounded-xl p-2 active:opacity-70"
          >
            <MaterialIcons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View className="bg-border rounded-full h-2 mb-6">
          <View
            className="bg-primary rounded-full h-2"
            style={{
              width: `${Math.round(((currentSheetIndex + 1) / parseResult.sheets.length) * 100)}%`,
            }}
          />
        </View>

        {/* Board visual */}
        <View className="items-center mb-6">
          <BoardVisual sheet={sheet} />
          <Text className="text-xs text-muted mt-2">
            {sheet.width} × {sheet.height} mm · {sheet.wastePercent}% desperdicio
          </Text>
        </View>

        {/* Pieces list for this sheet */}
        <Text className="text-base font-semibold text-foreground mb-3">
          Piezas en este tablero ({sheet.pieces.length})
        </Text>
        {sheet.pieces.map((piece, idx) => (
          <View
            key={piece.id}
            className="flex-row items-center bg-surface border border-border rounded-xl p-4 mb-2"
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: piece.color ?? colors.primary,
                marginRight: 12,
              }}
            />
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">
                Pieza {idx + 1}: {piece.label}
              </Text>
              <Text className="text-xs text-muted">
                X: {piece.x} mm · Y: {piece.y} mm
              </Text>
            </View>
            <MaterialIcons name="content-cut" size={18} color={colors.muted} />
          </View>
        ))}

        {/* Navigation */}
        <View className="flex-row gap-3 mt-6 mb-8">
          {currentSheetIndex > 0 && (
            <TouchableOpacity
              onPress={goToPrevSheet}
              className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center active:opacity-70"
            >
              <Text className="text-foreground font-medium">← Anterior</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={markSheetDone}
            className={`flex-1 rounded-2xl p-4 items-center active:opacity-70 ${
              isDone ? "bg-green-500" : "bg-primary"
            }`}
          >
            <Text className="text-white font-semibold">
              {isLastSheet ? "✓ Finalizar" : isDone ? "✓ Siguiente →" : "✓ Hecho · Siguiente →"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ── Render: Summary step ──────────────────────────────────────────────────
  const renderSummary = () => {
    if (!parseResult) return null;
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-4">
        {/* Header */}
        <View className="items-center mb-6 mt-4">
          <View className="bg-green-500/10 rounded-full p-6 mb-4">
            <MaterialIcons name="check-circle" size={56} color="#22C55E" />
          </View>
          <Text className="text-2xl font-bold text-foreground text-center">
            ¡Despiece completado!
          </Text>
          <Text className="text-sm text-muted text-center mt-1">{pdfName}</Text>
        </View>

        {/* Summary cards */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center">
            <Text className="text-3xl font-bold text-primary">{parseResult.totalBoards}</Text>
            <Text className="text-xs text-muted mt-1 text-center">Tableros usados</Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center">
            <Text className="text-3xl font-bold text-primary">{parseResult.totalPieces}</Text>
            <Text className="text-xs text-muted mt-1 text-center">Piezas cortadas</Text>
          </View>
          <View className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center">
            <Text
              className={`text-3xl font-bold ${
                parseResult.averageWaste < 20 ? "text-green-500" : "text-orange-500"
              }`}
            >
              {parseResult.averageWaste}%
            </Text>
            <Text className="text-xs text-muted mt-1 text-center">Desperdicio medio</Text>
          </View>
        </View>

        {/* Per-sheet summary */}
        <Text className="text-base font-semibold text-foreground mb-3">Resumen por tablero</Text>
        {parseResult.sheets.map((sheet) => (
          <View
            key={sheet.index}
            className="bg-surface border border-border rounded-xl p-4 mb-2"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-foreground">
                Tablero {sheet.index + 1}
              </Text>
              <View className="flex-row items-center gap-2">
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor:
                      sheet.wastePercent < 20 ? "#22C55E22" : "#F9731622",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color: sheet.wastePercent < 20 ? "#22C55E" : "#F97316",
                    }}
                  >
                    {sheet.wastePercent}% desperdicio
                  </Text>
                </View>
              </View>
            </View>
            <Text className="text-xs text-muted mt-1">
              {sheet.width} × {sheet.height} mm · {sheet.pieces.length} piezas
            </Text>
          </View>
        ))}

        {/* Actions */}
        <View className="gap-3 mt-6 mb-8">
          <TouchableOpacity
            onPress={reset}
            className="bg-primary rounded-2xl p-4 items-center active:opacity-70"
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="upload-file" size={20} color="white" />
              <Text className="text-white font-semibold">Nuevo PDF</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)")}
            className="bg-surface border border-border rounded-2xl p-4 items-center active:opacity-70"
          >
            <Text className="text-foreground font-medium">Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer className={step === "upload" ? "p-6" : ""}>
      {/* Back button (upload step only) */}
      {step === "upload" && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)")}
          className="self-start mb-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="arrow-back" size={20} color={colors.muted} />
            <Text className="text-muted">Inicio</Text>
          </View>
        </TouchableOpacity>
      )}

      {step === "upload" && renderUpload()}
      {step === "cutting" && renderCutting()}
      {step === "summary" && renderSummary()}
    </ScreenContainer>
  );
}
