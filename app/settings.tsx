import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [sawThickness, setSawThickness] = useState("3.2");
  const [trimMargin, setTrimMargin] = useState("5");
  const [units, setUnits] = useState<"mm" | "in">("mm");
  const [optimization, setOptimization] = useState<"waste" | "speed">("waste");

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with Back Button */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4" style={{minWidth: 0}}>
            <Text className="text-4xl font-bold text-foreground mb-2" numberOfLines={1}>Configuración</Text>
            <Text className="text-base text-muted" numberOfLines={2}>
              Ajusta los parámetros de tu aplicación
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)")}
            className="bg-primary rounded-full p-3 active:opacity-70"
            style={{flexShrink: 0}}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="gap-6">
          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">Parametros de Corte</Text>
            <View className="bg-surface border border-border rounded-lg p-4 gap-4">
              <View>
                <Text className="text-sm text-muted mb-2">Grosor del Disco de Sierra (mm)</Text>
                <TextInput
                  placeholder="3.2"
                  placeholderTextColor={colors.muted}
                  value={sawThickness}
                  onChangeText={setSawThickness}
                  keyboardType="decimal-pad"
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                />
              </View>
              <View>
                <Text className="text-sm text-muted mb-2">Margen de Refilado (mm)</Text>
                <TextInput
                  placeholder="5"
                  placeholderTextColor={colors.muted}
                  value={trimMargin}
                  onChangeText={setTrimMargin}
                  keyboardType="decimal-pad"
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                />
              </View>
            </View>
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">Unidades de Medida</Text>
            <View className="gap-2">
              {(["mm", "in"] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  onPress={() => setUnits(unit)}
                  className={`border rounded-lg p-4 flex-row items-center justify-between ${
                    units === unit ? "bg-primary border-primary" : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      units === unit ? "text-white" : "text-foreground"
                    }`}
                  >
                    {unit === "mm" ? "Milimetros (mm)" : "Pulgadas (in)"}
                  </Text>
                  {units === unit && (
                    <MaterialIcons name="check-circle" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">Optimizacion</Text>
            <View className="gap-2">
              {(["waste", "speed"] as const).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setOptimization(opt)}
                  className={`border rounded-lg p-4 flex-row items-center justify-between ${
                    optimization === opt ? "bg-primary border-primary" : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`text-base font-medium ${
                      optimization === opt ? "text-white" : "text-foreground"
                    }`}
                  >
                    {opt === "waste" ? "Minimo Desperdicio" : "Velocidad de Corte"}
                  </Text>
                  {optimization === opt && (
                    <MaterialIcons name="check-circle" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">Datos</Text>
            <View className="gap-2">
              <TouchableOpacity className="border border-border bg-surface rounded-lg p-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="download" size={24} color={colors.primary} />
                  <Text className="text-base font-medium text-foreground">Exportar Datos</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity className="border border-border bg-surface rounded-lg p-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="upload" size={24} color={colors.primary} />
                  <Text className="text-base font-medium text-foreground">Importar Datos</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity className="border border-error bg-surface rounded-lg p-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <MaterialIcons name="delete" size={24} color={colors.error} />
                  <Text className="text-base font-medium text-error">Borrar Datos</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">Acerca de</Text>
            <View className="bg-surface border border-border rounded-lg p-4 gap-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Version:</Text>
                <Text className="text-sm font-medium text-foreground">1.0.0</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted">Desarrollador:</Text>
                <Text className="text-sm font-medium text-foreground">Manus</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
