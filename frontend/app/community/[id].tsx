import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCommunity, agreeToRules } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { Community, Subgroup } from '../../src/types';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

const SUBGROUP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  chat: 'chatbubbles',
  political: 'megaphone',
  marketplace: 'storefront',
  festival: 'sparkles',
  events: 'calendar',
  volunteers: 'hand-left',
  invitations: 'mail',
  help: 'medkit',
};

const SUBGROUP_COLORS: Record<string, string> = {
  chat: COLORS.info,
  political: COLORS.warning,
  marketplace: COLORS.success,
  festival: '#9C27B0',
  events: COLORS.primary,
  volunteers: '#00BCD4',
  invitations: '#E91E63',
  help: COLORS.error,
};

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [rulesModal, setRulesModal] = useState<{ visible: boolean; subgroup: Subgroup | null }>({
    visible: false,
    subgroup: null,
  });

  useEffect(() => {
    fetchCommunity();
  }, [id]);

  const fetchCommunity = async () => {
    try {
      const response = await getCommunity(id!);
      setCommunity(response.data);
    } catch (error) {
      console.error('Error fetching community:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasAgreedToRules = (subgroupType: string) => {
    return user?.agreed_rules?.includes(`${id}_${subgroupType}`);
  };

  const handleSubgroupPress = (subgroup: Subgroup) => {
    if (hasAgreedToRules(subgroup.type)) {
      router.push(`/chat/community/${id}?subgroup=${subgroup.type}&name=${encodeURIComponent(subgroup.name)}`);
    } else {
      setRulesModal({ visible: true, subgroup });
    }
  };

  const handleAgreeRules = async () => {
    if (!rulesModal.subgroup) return;
    
    try {
      await agreeToRules(id!, rulesModal.subgroup.type);
      const newAgreedRules = [...(user?.agreed_rules || []), `${id}_${rulesModal.subgroup.type}`];
      updateUser({ agreed_rules: newAgreedRules } as any);
      setRulesModal({ visible: false, subgroup: null });
      router.push(`/chat/community/${id}?subgroup=${rulesModal.subgroup.type}&name=${encodeURIComponent(rulesModal.subgroup.name)}`);
    } catch (error) {
      console.error('Error agreeing to rules:', error);
    }
  };

  const renderSubgroup = ({ item }: { item: Subgroup }) => (
    <TouchableOpacity
      style={styles.subgroupCard}
      onPress={() => handleSubgroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${SUBGROUP_COLORS[item.type]}20` }]}>
        <Ionicons
          name={SUBGROUP_ICONS[item.type] || 'chatbubble'}
          size={24}
          color={SUBGROUP_COLORS[item.type] || COLORS.primary}
        />
      </View>
      <View style={styles.subgroupInfo}>
        <Text style={styles.subgroupName}>{item.name}</Text>
        <Text style={styles.subgroupRules} numberOfLines={1}>{item.rules}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Community not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.communityName}>{community.name}</Text>
          <Text style={styles.memberCount}>{community.member_count} members</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.codeLabel}>Code</Text>
          <Text style={styles.codeText}>{community.code}</Text>
        </View>
      </View>

      {/* Subgroups */}
      <FlatList
        data={community.subgroups}
        renderItem={renderSubgroup}
        keyExtractor={(item) => item.type}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Floating Rules Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setRulesModal({ visible: true, subgroup: null })}
      >
        <Ionicons name="book" size={24} color={COLORS.textWhite} />
      </TouchableOpacity>

      {/* Rules Modal */}
      <Modal
        visible={rulesModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setRulesModal({ visible: false, subgroup: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {rulesModal.subgroup ? `${rulesModal.subgroup.name} Rules` : 'Community Rules'}
              </Text>
              <TouchableOpacity onPress={() => setRulesModal({ visible: false, subgroup: null })}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.rulesContainer}>
              {rulesModal.subgroup ? (
                <Text style={styles.rulesText}>{rulesModal.subgroup.rules}</Text>
              ) : (
                community.subgroups.map((sg) => (
                  <View key={sg.type} style={styles.ruleItem}>
                    <Text style={styles.ruleTitle}>{sg.name}</Text>
                    <Text style={styles.ruleText}>{sg.rules}</Text>
                  </View>
                ))
              )}
            </View>

            {rulesModal.subgroup && !hasAgreedToRules(rulesModal.subgroup.type) && (
              <TouchableOpacity style={styles.agreeButton} onPress={handleAgreeRules}>
                <Text style={styles.agreeButtonText}>I Agree</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  codeLabel: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  listContent: {
    padding: SPACING.md,
  },
  subgroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  subgroupInfo: {
    flex: 1,
  },
  subgroupName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  subgroupRules: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  separator: {
    height: SPACING.sm,
  },
  floatingButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  rulesContainer: {
    marginBottom: SPACING.lg,
  },
  rulesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  ruleItem: {
    marginBottom: SPACING.md,
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  ruleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  agreeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  agreeButtonText: {
    color: COLORS.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});
