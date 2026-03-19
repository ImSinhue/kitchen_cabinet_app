'use client';
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

interface Module {
  id: string;
  projectId: string;
  name: string;
  moduleHeight: "alto" | "bajo" | "columna" | null;
  height: string;
  width: string;
  depth: string;
  type: "with-back" | "no-back" | null;
  backPanelChannel: "with-channel" | "without-channel" | null;
  barLowerBack: boolean;
  barUpperBack: boolean;
  barFrontHorizontal: boolean;
  barFrontVertical: boolean;
  barLowerBackDepth: string;
  barUpperBackDepth: string;
  barFrontHorizontalDepth: string;
  barFrontVerticalDepth: string;
  drawerCount: number | null | undefined;
  drawerHeights: string[];
  drawerHeightTypes: ("interior" | "exterior")[];
  doorCount: number | null | undefined;
  doorHeights: string[];
  doorWidths: string[];
  doorPositions: ("superior" | "inferior" | "otro")[];
  doorOtherHeights: string[];
}

export default function CreateModuleScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams();
  const [projectId, setProjectId] = useState("");

  const [name, setName] = useState("");
  const [moduleHeight, setModuleHeight] = useState<"alto" | "bajo" | "columna" | null>(null);
  const [height, setHeight] = useState("800");
  const [width, setWidth] = useState("600");
  const [depth, setDepth] = useState("600");
  const [type, setType] = useState<"with-back" | "no-back" | null>(null);
  const [backPanelChannel, setBackPanelChannel] = useState<"with-channel" | "without-channel" | null>(null);
  const [barLowerBack, setBarLowerBack] = useState(false);
  const [barUpperBack, setBarUpperBack] = useState(false);
  const [barFrontHorizontal, setBarFrontHorizontal] = useState(false);
  const [barFrontVertical, setBarFrontVertical] = useState(false);
  const [barLowerBackDepth, setBarLowerBackDepth] = useState("100");
  const [barUpperBackDepth, setBarUpperBackDepth] = useState("150");
  const [barFrontHorizontalDepth, setBarFrontHorizontalDepth] = useState("100");
  const [barFrontVerticalDepth, setBarFrontVerticalDepth] = useState("57");
  const [hasDrawers, setHasDrawers] = useState<boolean | null>(null);
  const [drawerCount, setDrawerCount] = useState<number | null | undefined>(undefined);
  const [drawerHeights, setDrawerHeights] = useState<string[]>([]);
  const [drawerHeightTypes, setDrawerHeightTypes] = useState<("interior" | "exterior")[]>([]);

  const [hasDoors, setHasDoors] = useState<boolean | null>(null);
  const [doorCount, setDoorCount] = useState<number | null | undefined>(undefined);
  const [doorHeights, setDoorHeights] = useState<string[]>([]);
  const [doorWidths, setDoorWidths] = useState<string[]>([]);
  const [doorPositions, setDoorPositions] = useState<("superior" | "inferior" | "otro")[]>([]);
  const [doorOtherHeights, setDoorOtherHeights] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const getProjectId = async () => {
      // Obtener projectId de los parámetros de la ruta
      const paramProjectId = params.projectId as string;
      if (paramProjectId) {
        setProjectId(paramProjectId);
      } else {
        // Fallback: intentar obtener de AsyncStorage
        const id = await AsyncStorage.getItem("currentProjectId");
        if (id) setProjectId(id);
      }
    };
    getProjectId();
  }, [params]);

  const handleCreateAnother = () => {
    setName("");
    setModuleHeight(null);
    setHeight("800");
    setWidth("600");
    setDepth("600");
    setType(null);
    setBackPanelChannel(null);
    setBarLowerBack(false);
    setBarUpperBack(false);
    setBarFrontHorizontal(false);
    setBarFrontVertical(false);
    setBarLowerBackDepth("100");
    setBarUpperBackDepth("150");
    setBarFrontHorizontalDepth("100");
    setBarFrontVerticalDepth("57");
    setHasDrawers(null);
    setDrawerCount(undefined);
    setDrawerHeights([]);
    setDrawerHeightTypes([]);

    setHasDoors(null);
    setDoorCount(undefined);
    setDoorHeights([]);
    setDoorWidths([]);
    setDoorPositions([]);
    setDoorOtherHeights([]);
    setShowSuccess(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Por favor ingresa un nombre para el módulo");
      return;
    }

    const newModule: Module = {
      id: Date.now().toString(),
      projectId: projectId || "",
      name,
      moduleHeight,
      height,
      width,
      depth,
      type,
      backPanelChannel,
      barLowerBack,
      barUpperBack,
      barFrontHorizontal,
      barFrontVertical,
      barLowerBackDepth,
      barUpperBackDepth,
      barFrontHorizontalDepth,
      barFrontVerticalDepth,
      drawerCount,
      drawerHeights,
      drawerHeightTypes,

      doorCount,
      doorHeights,
      doorWidths,
      doorPositions,
      doorOtherHeights,
    };

    try {
      const existingModules = await AsyncStorage.getItem("modules");
      const modules = existingModules ? JSON.parse(existingModules) : [];
      modules.push(newModule);
      await AsyncStorage.setItem("modules", JSON.stringify(modules));
      setShowSuccess(true);
      setTimeout(() => {
        // Volver a project-summary si viene de ahí, sino crear otro
        if (projectId) {
          router.push({
            pathname: "/project-summary",
            params: { projectId },
          });
        } else {
          handleCreateAnother();
        }
      }, 1000);
    } catch (error) {
      console.error("Error saving module:", error);
      alert("Error al guardar el módulo");
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6 pb-6">
          <Text className="text-2xl font-bold text-foreground">Crear Módulo</Text>

          {/* Nombre */}
          <View className="gap-2">
            <Text className="text-base font-semibold text-foreground">Nombre</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Módulo cocina"
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-base text-foreground"
            />
          </View>

          {/* Tipo de Módulo */}
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">Tipo de Módulo</Text>
            <View className="flex-row gap-3">
              {["alto", "bajo", "columna"].map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setModuleHeight(option as "alto" | "bajo" | "columna")}
                  className={`flex-1 py-2 rounded-lg border-2 items-center ${
                    moduleHeight === option
                      ? "border-primary bg-primary"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold capitalize ${
                      moduleHeight === option ? "text-white" : "text-foreground"
                    }`}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Medidas */}
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">Medidas (mm)</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">Alto</Text>
                <TextInput
                  value={height}
                  onChangeText={setHeight}
                  placeholder="800"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-base text-foreground"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">Ancho</Text>
                <TextInput
                  value={width}
                  onChangeText={setWidth}
                  placeholder="600"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-base text-foreground"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">Profundo</Text>
                <TextInput
                  value={depth}
                  onChangeText={setDepth}
                  placeholder="600"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-base text-foreground"
                />
              </View>
            </View>
          </View>

          {/* Trasera */}
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">Trasera</Text>
            {type === null && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setType("with-back");
                    setBackPanelChannel(null);
                  }}
                  className="flex-1 py-2 rounded-lg border-2 items-center border-border bg-surface"
                >
                  <Text className="text-sm font-semibold text-foreground">Sí</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setType("no-back");
                    setBackPanelChannel(null);
                  }}
                  className="flex-1 py-2 rounded-lg border-2 items-center border-border bg-surface"
                >
                  <Text className="text-sm font-semibold text-foreground">No</Text>
                </TouchableOpacity>
              </View>
            )}

            {type === "with-back" && (
              <View className="flex-row gap-3 items-center">
                <TouchableOpacity
                  onPress={() => {
                    setType(null);
                    setBackPanelChannel(null);
                  }}
                  className="py-2 rounded-lg border-2 items-center border-primary bg-primary px-4"
                >
                  <Text className="text-sm font-semibold text-white">Sí</Text>
                </TouchableOpacity>

                <View className="gap-2 flex-1">
                  <Pressable
                    onPress={() => setBackPanelChannel("with-channel")}
                    className="flex-row items-center gap-3"
                  >
                    <View
                      className={`w-6 h-6 rounded border-2 items-center justify-center ${
                        backPanelChannel === "with-channel"
                          ? "bg-primary border-primary"
                          : "border-border bg-surface"
                      }`}
                    >
                      {backPanelChannel === "with-channel" && (
                        <MaterialIcons name="check" size={16} color="white" />
                      )}
                    </View>
                    <Text className="text-sm text-foreground">Con canal</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setBackPanelChannel("without-channel")}
                    className="flex-row items-center gap-3"
                  >
                    <View
                      className={`w-6 h-6 rounded border-2 items-center justify-center ${
                        backPanelChannel === "without-channel"
                          ? "bg-primary border-primary"
                          : "border-border bg-surface"
                      }`}
                    >
                      {backPanelChannel === "without-channel" && (
                        <MaterialIcons name="check" size={16} color="white" />
                      )}
                    </View>
                    <Text className="text-sm text-foreground">Sin canal</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {type === "no-back" && (
              <View className="flex-row gap-3 items-start">
                <TouchableOpacity
                  onPress={() => {
                    setType(null);
                    setBackPanelChannel(null);
                  }}
                  className="py-2 rounded-lg border-2 items-center border-primary bg-primary px-4"
                >
                  <Text className="text-sm font-semibold text-white">No</Text>
                </TouchableOpacity>

                <View className="gap-2 flex-1">
                  <View>
                    <Pressable
                      onPress={() => setBarLowerBack(!barLowerBack)}
                      className="flex-row items-center gap-3 py-1"
                    >
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center ${
                          barLowerBack
                            ? "bg-primary border-primary"
                            : "border-border bg-surface"
                        }`}
                      >
                        {barLowerBack && (
                          <MaterialIcons name="check" size={16} color="white" />
                        )}
                      </View>
                      <Text className="text-sm text-foreground">Barra trasera inferior</Text>
                    </Pressable>
                    {barLowerBack && (
                      <View className="ml-9 py-1">
                        <TextInput
                          value={barLowerBackDepth}
                          onChangeText={setBarLowerBackDepth}
                          placeholder="100"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                    )}
                  </View>

                  <View>
                    <Pressable
                      onPress={() => setBarUpperBack(!barUpperBack)}
                      className="flex-row items-center gap-3 py-1"
                    >
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center ${
                          barUpperBack
                            ? "bg-primary border-primary"
                            : "border-border bg-surface"
                        }`}
                      >
                        {barUpperBack && (
                          <MaterialIcons name="check" size={16} color="white" />
                        )}
                      </View>
                      <Text className="text-sm text-foreground">Barra trasera superior</Text>
                    </Pressable>
                    {barUpperBack && (
                      <View className="ml-9 py-1">
                        <TextInput
                          value={barUpperBackDepth}
                          onChangeText={setBarUpperBackDepth}
                          placeholder="150"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                    )}
                  </View>

                  <View>
                    <Pressable
                      onPress={() => setBarFrontHorizontal(!barFrontHorizontal)}
                      className="flex-row items-center gap-3 py-1"
                    >
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center ${
                          barFrontHorizontal
                            ? "bg-primary border-primary"
                            : "border-border bg-surface"
                        }`}
                      >
                        {barFrontHorizontal && (
                          <MaterialIcons name="check" size={16} color="white" />
                        )}
                      </View>
                      <Text className="text-sm text-foreground">Barra delantera horizontal</Text>
                    </Pressable>
                    {barFrontHorizontal && (
                      <View className="ml-9 py-1">
                        <TextInput
                          value={barFrontHorizontalDepth}
                          onChangeText={setBarFrontHorizontalDepth}
                          placeholder="100"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                    )}
                  </View>

                  <View>
                    <Pressable
                      onPress={() => setBarFrontVertical(!barFrontVertical)}
                      className="flex-row items-center gap-3 py-1"
                    >
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center ${
                          barFrontVertical
                            ? "bg-primary border-primary"
                            : "border-border bg-surface"
                        }`}
                      >
                        {barFrontVertical && (
                          <MaterialIcons name="check" size={16} color="white" />
                        )}
                      </View>
                      <Text className="text-sm text-foreground">Barra delantera vertical</Text>
                    </Pressable>
                    {barFrontVertical && (
                      <View className="ml-9 py-1">
                        <TextInput
                          value={barFrontVerticalDepth}
                          onChangeText={setBarFrontVerticalDepth}
                          placeholder="57"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Cajones */}
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">Cajones</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setHasDrawers(true);
                  setDrawerCount(1);
                  setDrawerHeights([""]);
                  setDrawerHeightTypes(["interior"]);
                }}
                className={`flex-1 py-2 rounded-lg border-2 items-center ${
                  hasDrawers === true
                    ? `border-primary bg-primary`
                    : `border-border bg-surface`
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    hasDrawers === true ? "text-white" : "text-foreground"
                  }`}
                >
                  Sí
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setHasDrawers(false);
                  setDrawerCount(undefined);
                  setDrawerHeights([]);
                  setDrawerHeightTypes([]);
                }}
                className={`flex-1 py-2 rounded-lg border-2 items-center ${
                  hasDrawers === false
                    ? `border-primary bg-primary`
                    : `border-border bg-surface`
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    hasDrawers === false ? "text-white" : "text-foreground"
                  }`}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>

            {hasDrawers === true && (
              <>
                <Text className="text-sm text-muted">Cantidad</Text>
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <TouchableOpacity
                      key={num}
                      onPress={() => {
                        setDrawerCount(num);
                        setDrawerHeights(Array(num).fill(""));
                        setDrawerHeightTypes(Array(num).fill("interior"));
                      }}
                      className={`flex-1 py-2 rounded-lg border-2 items-center ${
                        drawerCount === num
                          ? "border-primary bg-primary"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          drawerCount === num ? "text-white" : "text-foreground"
                        }`}
                      >
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {typeof drawerCount === "number" && drawerCount > 0 && (
                  <View className="gap-3">
                    {Array.from({ length: drawerCount }).map((_, index) => (
                      <View key={index} className="gap-2">
                        <Text className="text-sm text-muted">Altura cajón {index + 1}</Text>
                        <View className="flex-row gap-2 items-center">
                          <View className="flex-1">
                            <TextInput
                              value={drawerHeights[index] || ""}
                              onChangeText={(val) => {
                                const newHeights = [...drawerHeights];
                                newHeights[index] = val;
                                setDrawerHeights(newHeights);
                              }}
                              placeholder="0"
                              placeholderTextColor={colors.muted}
                              keyboardType="decimal-pad"
                              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                            />
                          </View>
                          <Pressable
                            onPress={() => {
                              const newTypes = [...drawerHeightTypes];
                              newTypes[index] = newTypes[index] === "interior" ? "exterior" : "interior";
                              setDrawerHeightTypes(newTypes);
                            }}
                            className="flex-row items-center gap-2"
                          >
                            <View
                              className={`w-5 h-5 rounded border-2 items-center justify-center ${
                                drawerHeightTypes[index] === "interior"
                                  ? "bg-primary border-primary"
                                  : "border-border"
                              }`}
                            >
                              {drawerHeightTypes[index] === "interior" && (
                                <MaterialIcons name="check" size={14} color="white" />
                              )}
                            </View>
                            <Text className="text-xs text-foreground">Int</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              const newTypes = [...drawerHeightTypes];
                              newTypes[index] = newTypes[index] === "exterior" ? "interior" : "exterior";
                              setDrawerHeightTypes(newTypes);
                            }}
                            className="flex-row items-center gap-2"
                          >
                            <View
                              className={`w-5 h-5 rounded border-2 items-center justify-center ${
                                drawerHeightTypes[index] === "exterior"
                                  ? "bg-primary border-primary"
                                  : "border-border"
                              }`}
                            >
                              {drawerHeightTypes[index] === "exterior" && (
                                <MaterialIcons name="check" size={14} color="white" />
                              )}
                            </View>
                            <Text className="text-xs text-foreground">Ext</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Puertas */}
          <View className="gap-3">
            <Text className="text-base font-semibold text-foreground">Puertas</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setHasDoors(true);
                  setDoorCount(1);
                  setDoorHeights([""]);
                  setDoorWidths([""]);
                  setDoorPositions(["superior"]);
                  setDoorOtherHeights([""]);
                }}
                className={`flex-1 py-2 rounded-lg border-2 items-center ${
                  hasDoors === true
                    ? `border-primary bg-primary`
                    : `border-border bg-surface`
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    hasDoors === true ? "text-white" : "text-foreground"
                  }`}
                >
                  Sí
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setHasDoors(false);
                  setDoorCount(undefined);
                  setDoorHeights([]);
                  setDoorWidths([]);
                  setDoorPositions([]);
                  setDoorOtherHeights([]);
                }}
                className={`flex-1 py-2 rounded-lg border-2 items-center ${
                  hasDoors === false
                    ? `border-primary bg-primary`
                    : `border-border bg-surface`
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    hasDoors === false ? "text-white" : "text-foreground"
                  }`}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>

            {hasDoors === true && (
              <>
                <Text className="text-sm text-muted">Cantidad</Text>
                <View className="flex-row gap-2">
                  {[1, 2, 3].map((num) => (
                    <TouchableOpacity
                      key={num}
                      onPress={() => {
                        setDoorCount(num);
                        setDoorHeights(Array(num).fill(""));
                        setDoorWidths(Array(num).fill(""));
                        setDoorPositions(Array(num).fill("superior"));
                        setDoorOtherHeights(Array(num).fill(""));
                      }}
                      className={`flex-1 py-2 rounded-lg border-2 items-center ${
                        doorCount === num
                          ? "border-primary bg-primary"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          doorCount === num ? "text-white" : "text-foreground"
                        }`}
                      >
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {typeof doorCount === "number" && doorCount > 0 && (
                  <View className="gap-4">
                    {Array.from({ length: doorCount }).map((_, index) => (
                      <View key={index} className="gap-3 border border-border rounded-lg p-3">
                        <Text className="text-sm font-semibold text-foreground">Puerta {index + 1}</Text>

                        <View className="gap-2">
                          <Text className="text-xs text-muted">Medida (mm)</Text>
                          <View className="flex-row gap-2">
                            <View className="flex-1">
                              <Text className="text-xs text-muted mb-1">Alto</Text>
                              <TextInput
                                value={doorHeights[index] || ""}
                                onChangeText={(val) => {
                                  const newHeights = [...doorHeights];
                                  newHeights[index] = val;
                                  setDoorHeights(newHeights);
                                }}
                                placeholder="0"
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                              />
                            </View>
                            <View className="flex-1">
                              <Text className="text-xs text-muted mb-1">Ancho</Text>
                              <TextInput
                                value={doorWidths[index] || ""}
                                onChangeText={(val) => {
                                  const newWidths = [...doorWidths];
                                  newWidths[index] = val;
                                  setDoorWidths(newWidths);
                                }}
                                placeholder="0"
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                              />
                            </View>
                          </View>
                        </View>

                        <View className="gap-2">
                          <Text className="text-sm font-semibold text-foreground">Posición</Text>
                          <View className="flex-row gap-2">
                            {["superior", "inferior", "otro"].map((pos) => (
                              <Pressable
                                key={pos}
                                onPress={() => {
                                  const newPositions = [...doorPositions];
                                  newPositions[index] = pos as "superior" | "inferior" | "otro";
                                  setDoorPositions(newPositions);
                                }}
                                className="flex-1 flex-row items-center gap-2 px-3 py-2"
                              >
                                <View
                                  className={`w-5 h-5 rounded border-2 items-center justify-center ${
                                    doorPositions[index] === pos
                                      ? "bg-primary border-primary"
                                      : "border-border bg-surface"
                                  }`}
                                >
                                  {doorPositions[index] === pos && (
                                    <MaterialIcons name="check" size={14} color="white" />
                                  )}
                                </View>
                                <Text className="text-xs text-foreground capitalize">{pos}</Text>
                              </Pressable>
                            ))}
                          </View>

                          {doorPositions[index] === "otro" && (
                            <View className="mt-2">
                              <Text className="text-xs text-muted mb-1">Altura personalizada</Text>
                              <TextInput
                                value={doorOtherHeights[index] || ""}
                                onChangeText={(val) => {
                                  const newHeights = [...doorOtherHeights];
                                  newHeights[index] = val;
                                  setDoorOtherHeights(newHeights);
                                }}
                                placeholder="0"
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Botones de Acción */}
          <View className="gap-3 pt-4">
            <TouchableOpacity
              onPress={handleSave}
              className="bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-white font-semibold">Guardar Módulo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/")}
              className="border border-primary rounded-lg py-3 items-center"
            >
              <Text className="text-primary font-semibold">Cancelar</Text>
            </TouchableOpacity>
          </View>

          {showSuccess && (
            <View className="bg-success rounded-lg p-3 items-center">
              <Text className="text-white font-semibold">¡Módulo guardado!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
