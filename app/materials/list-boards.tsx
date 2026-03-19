import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Modal, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";

export default function ListBoardsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>("");
  
  const { data: boards = [], isLoading, refetch } = trpc.boards.list.useQuery();
  
  const deleteMutation = trpc.boards.delete.useMutation({
    onSuccess: () => {
      console.log("[ListBoards] Delete successful, refetching...");
      setDeletingId(null);
      refetch();
    },
    onError: (error) => {
      console.error("[ListBoards] Delete error:", error);
      setDeletingId(null);
    },
  });

  const updateMutation = trpc.boards.update.useMutation({
    onSuccess: () => {
      console.log("[ListBoards] Update successful");
      refetch();
      setEditingId(null);
      setEditData({});
    },
    onError: (error) => {
      console.error("[ListBoards] Update error:", error);
    },
  });

  // Agrupar tableros por grosor
  const groupedBoards = useMemo(() => {
    const groups: { [key: number]: any[] } = {};
    
    boards.forEach((board: any) => {
      const thickness = board.thickness;
      if (!groups[thickness]) {
        groups[thickness] = [];
      }
      groups[thickness].push(board);
    });

    return Object.keys(groups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((thickness) => ({
        title: `${thickness}mm`,
        data: groups[parseInt(thickness)],
      }));
  }, [boards]);

  const handleDelete = (id: number, name: string) => {
    console.log("[ListBoards] Delete clicked for id:", id, "name:", name);
    setDeletingId(id);
    setDeleteConfirmName(name);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    
    console.log("[ListBoards] Confirming delete for id:", deletingId);
    setDeletingId(null);
    
    try {
      await deleteMutation.mutateAsync({ id: deletingId });
      console.log("[ListBoards] Delete completed successfully");
    } catch (error) {
      console.error("[ListBoards] Delete failed:", error);
    }
  };

  const handleEditStart = (board: any) => {
    console.log("[ListBoards] Edit started for board:", board);
    setEditingId(board.id);
    setEditData({
      name: board.name,
      materialType: board.materialType,
      width: board.width.toString(),
      height: board.height.toString(),
      thickness: board.thickness.toString(),
      price: board.price,
      quantity: board.quantity.toString(),
    });
  };

  const handleEditSave = async (id: number) => {
    try {
      console.log("[ListBoards] Saving board with id:", id);
      await updateMutation.mutateAsync({
        id,
        name: editData.name,
        materialType: editData.materialType,
        width: parseInt(editData.width) || 2850,
        height: parseInt(editData.height) || 2100,
        thickness: parseInt(editData.thickness) || 16,
        price: editData.price,
        quantity: parseInt(editData.quantity) || 0,
      });
      console.log("[ListBoards] Update completed successfully");
    } catch (error) {
      console.error("[ListBoards] Update error:", error);
    }
  };

  const renderBoard = (board: any) => {
    const isEditing = editingId === board.id;

    if (isEditing) {
      return (
        <View key={board.id} className="bg-surface border-2 border-primary rounded-lg p-4 mb-3">
          <View className="gap-3">
            {/* Nombre */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-1">Nombre</Text>
              <TextInput
                value={editData.name}
                onChangeText={(text) => setEditData({ ...editData, name: text })}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </View>

            {/* Material */}
            <View>
              <Text className="text-sm font-semibold text-foreground mb-1">Material</Text>
              <TextInput
                value={editData.materialType}
                onChangeText={(text) => setEditData({ ...editData, materialType: text })}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </View>

            {/* Dimensiones */}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-1">Ancho</Text>
                <TextInput
                  value={editData.width}
                  onChangeText={(text) => setEditData({ ...editData, width: text })}
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-1">Alto</Text>
                <TextInput
                  value={editData.height}
                  onChangeText={(text) => setEditData({ ...editData, height: text })}
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-1">Espesor</Text>
                <TextInput
                  value={editData.thickness}
                  onChangeText={(text) => setEditData({ ...editData, thickness: text })}
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </View>
            </View>

            {/* Precio y Cantidad */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-1">Precio (€)</Text>
                <TextInput
                  value={editData.price}
                  onChangeText={(text) => setEditData({ ...editData, price: text })}
                  keyboardType="decimal-pad"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground mb-1">Cantidad</Text>
                <TextInput
                  value={editData.quantity}
                  onChangeText={(text) => setEditData({ ...editData, quantity: text })}
                  keyboardType="number-pad"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </View>
            </View>

            {/* Botones */}
            <View className="flex-row gap-2 mt-2">
              <TouchableOpacity
                onPress={() => handleEditSave(board.id)}
                disabled={updateMutation.isPending}
                className="flex-1 bg-success rounded-lg py-2 items-center justify-center"
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Guardar</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setEditingId(null);
                  setEditData({});
                }}
                className="flex-1 bg-border rounded-lg py-2 items-center justify-center"
              >
                <Text className="text-foreground font-semibold text-sm">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View key={board.id} className="bg-surface border border-border rounded-lg p-3 mb-3">
        <View className="flex-row justify-between items-start gap-3">
          {/* Información del tablero */}
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">
              {board.name}
            </Text>
            <Text className="text-xs text-muted mt-1">
              Material: {board.materialType}
            </Text>
            <Text className="text-xs text-muted mt-1">
              Dim: {board.width} x {board.height} x {board.thickness}mm
            </Text>
            <View className="flex-row gap-4 mt-2">
              <Text className="text-xs font-semibold text-foreground">
                {board.price}€
              </Text>
              <Text className="text-xs text-muted">
                Stock: {board.quantity}
              </Text>
            </View>
          </View>

          {/* Botones de acción */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleEditStart(board)}
              className="bg-primary rounded-lg p-2 items-center justify-center"
            >
              <MaterialIcons name="edit" size={18} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(board.id, board.name)}
              disabled={deleteMutation.isPending}
              className={`rounded-lg p-2 items-center justify-center ${
                deleteMutation.isPending ? "bg-gray-400" : "bg-error"
              }`}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <MaterialIcons name="delete" size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="p-4">
      <View className="flex-1">
        {/* Header */}
        <View className="mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-2 mb-2"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            <Text className="text-lg font-semibold text-primary">Volver</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">
            Listado de Tableros
          </Text>
          <Text className="text-sm text-muted mt-1">
            {boards.length} tablero{boards.length !== 1 ? "s" : ""} disponible{boards.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : boards.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <View className="bg-surface border border-border rounded-2xl p-6 items-center justify-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-center text-foreground font-semibold mt-3 text-lg">
                No hay tableros
              </Text>
              <Text className="text-center text-muted mt-1 text-sm">
                Crea un nuevo tablero para comenzar
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {groupedBoards.map((group) => (
              <View key={group.title}>
                <View className="bg-primary rounded-lg px-3 py-2 mb-2 mt-3">
                  <Text className="text-white font-bold text-sm">
                    Grosor: {group.title}
                  </Text>
                </View>
                {group.data.map((board) => renderBoard(board))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Botón para crear nuevo tablero */}
        {boards.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/materials/create-board")}
            className="bg-primary rounded-lg py-3 items-center justify-center mt-3"
          >
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="add" size={20} color="white" />
              <Text className="text-white font-semibold text-base">Agregar Tablero</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de confirmación de eliminación */}
      <Modal
        visible={deletingId !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeletingId(null)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-4">
              <View className="bg-error/20 rounded-full p-3 mb-3">
                <MaterialIcons name="warning" size={32} color={colors.error} />
              </View>
              <Text className="text-lg font-bold text-foreground text-center">
                Eliminar Tablero
              </Text>
            </View>

            <Text className="text-sm text-muted text-center mb-6">
              ¿Estás seguro de que deseas eliminar "{deleteConfirmName}"?
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setDeletingId(null)}
                className="flex-1 bg-border rounded-lg py-3 items-center justify-center"
              >
                <Text className="text-foreground font-semibold text-sm">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-error rounded-lg py-3 items-center justify-center"
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Eliminar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
