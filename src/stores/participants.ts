import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { supabase } from "../supabase";
import Participant from "../types/supabase";
import { useAuthStore } from "./auth";

export const useParticipantsStore = defineStore("participants", () => {
  const participants = ref<Participant[]>([]);
  const currentParticipant = ref<Participant | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const searchQuery = ref("");
  const lastSearchQuery = ref("");
  const authStore = useAuthStore();

  // Obtener participantes con búsqueda
  const fetchParticipants = async (query: string = "") => {
    if (!authStore.isAuthenticated()) return;

    // Solo activar loading si hay una búsqueda activa o si explícitamente
    // se pasa un parámetro para indicar carga inicial
    const isInitialLoad = query === "" && participants.value.length === 0;
    loading.value = isInitialLoad ? true : !!query;

    console.log("Fetching participants with query:", query);
    lastSearchQuery.value = query;
    try {
      const { data, error } = await supabase
        .from("participants")
        .select()
        .textSearch("full_name", `'${query}'`);

      // if (queryError) throw queryError;
      console.log("Data:", data);
      console.log("Error:", error);

      participants.value = data as Participant[];
      console.log("Participants.value data saved:", participants.value);
    } catch (err: any) {
      console.error("Error al obtener participantes:", err);
      error.value = err.message || "Error al obtener participantes";
    } finally {
      loading.value = false;
    }
  };

  // Configurar suscripción en tiempo real
  const setupRealtimeSubscription = () => {
    if (!authStore.isAuthenticated()) return;

    // Primero eliminamos cualquier suscripción anterior
    supabase.removeAllChannels();

    // Configurar la nueva suscripción
    const channel = supabase
      .channel("public:participants")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
        },
        (payload) => {
          // Actualizar la lista al recibir cambios
          fetchParticipants(searchQuery.value);
        }
      )
      .subscribe();

    return channel;
  };

  // Obtener un participante por ID
  const fetchParticipantById = async (id: number) => {
    if (!authStore.isAuthenticated()) return;

    loading.value = true;

    try {
      const { data, error: queryError } = await supabase
        .from("participants")
        .select("*")
        .eq("id", id)
        .single();

      if (queryError) throw queryError;

      currentParticipant.value = data as Participant;
    } catch (err: any) {
      console.error(`Error al obtener participante id=${id}:`, err);
      error.value = err.message || "Error al obtener el participante";
    } finally {
      loading.value = false;
    }
  };

  // Actualizar un participante
  const updateParticipant = async (id: number, data: Partial<Participant>) => {
    if (!authStore.isAuthenticated())
      return { success: false, error: "No autenticado" };

    loading.value = true;

    try {
      const { data: updatedData, error: updateError } = await supabase
        .from("participants")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (updateError) throw updateError;

      currentParticipant.value = updatedData as Participant;

      // Actualizar el participante en la lista si existe
      const index = participants.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        participants.value[index] = updatedData as Participant;
      }

      return { success: true, data: updatedData };
    } catch (err: any) {
      console.error(`Error al actualizar participante id=${id}:`, err);
      error.value = err.message || "Error al actualizar el participante";
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  return {
    participants,
    currentParticipant,
    loading,
    error,
    searchQuery,
    lastSearchQuery,
    fetchParticipants,
    fetchParticipantById,
    updateParticipant,
    setupRealtimeSubscription,
  };
});
