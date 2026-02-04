import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { createCommunity } from '../services/database';

interface CreateCommunityScreenProps {
    userId: string;
    onBack: () => void;
    onCommunityCreated: () => void;
}

type Visibility = 'open' | 'invite_only' | 'closed';

const COMMON_BADGES = ['🏛️', '⚔️', '🛡️', '👑', '🏰', '🔥', '⚡', '🌟', '💎', '🎯'];

export default function CreateCommunityScreen({
    userId,
    onBack,
    onCommunityCreated
}: CreateCommunityScreenProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [badge, setBadge] = useState('🏛️');
    const [maxMembers, setMaxMembers] = useState('50');
    const [visibility, setVisibility] = useState<Visibility>('open');
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        // Validation
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a community name');
            return;
        }

        if (name.length < 3) {
            Alert.alert('Error', 'Community name must be at least 3 characters');
            return;
        }

        if (name.length > 30) {
            Alert.alert('Error', 'Community name must be less than 30 characters');
            return;
        }

        const maxMembersNum = parseInt(maxMembers);
        if (isNaN(maxMembersNum) || maxMembersNum < 10 || maxMembersNum > 100) {
            Alert.alert('Error', 'Max members must be between 10 and 100');
            return;
        }

        setCreating(true);
        try {
            const { data, error } = await createCommunity(
                userId,
                name.trim(),
                description.trim(),
                badge,
                maxMembersNum,
                visibility
            );

            if (error) throw error;

            Alert.alert(
                'Success!',
                `Your community "${name}" has been created!`,
                [{ text: 'OK', onPress: onCommunityCreated }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to create community');
        } finally {
            setCreating(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Create Community</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Community Name */}
                <View style={styles.section}>
                    <Text style={styles.label}>Community Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter community name..."
                        value={name}
                        onChangeText={setName}
                        maxLength={30}
                        autoCapitalize="words"
                    />
                    <Text style={styles.helperText}>{name.length}/30 characters</Text>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <Text style={styles.label}>Description (Optional)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Describe your community..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        maxLength={200}
                    />
                    <Text style={styles.helperText}>{description.length}/200 characters</Text>
                </View>

                {/* Badge Selector */}
                <View style={styles.section}>
                    <Text style={styles.label}>Community Badge</Text>
                    <View style={styles.badgeContainer}>
                        {COMMON_BADGES.map((b) => (
                            <TouchableOpacity
                                key={b}
                                style={[
                                    styles.badgeOption,
                                    badge === b && styles.badgeOptionSelected
                                ]}
                                onPress={() => setBadge(b)}
                            >
                                <Text style={styles.badgeText}>{b}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Max Members */}
                <View style={styles.section}>
                    <Text style={styles.label}>Maximum Members</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="50"
                        value={maxMembers}
                        onChangeText={setMaxMembers}
                        keyboardType="number-pad"
                        maxLength={3}
                    />
                    <Text style={styles.helperText}>Choose between 10 and 100</Text>
                </View>

                {/* Visibility Selector */}
                <View style={styles.section}>
                    <Text style={styles.label}>Visibility</Text>

                    <TouchableOpacity
                        style={[
                            styles.visibilityOption,
                            visibility === 'open' && styles.visibilityOptionSelected
                        ]}
                        onPress={() => setVisibility('open')}
                    >
                        <View style={styles.radioOuter}>
                            {visibility === 'open' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.visibilityContent}>
                            <View style={styles.visibilityHeader}>
                                <Text style={styles.visibilityIcon}>🌍</Text>
                                <Text style={styles.visibilityTitle}>Open</Text>
                            </View>
                            <Text style={styles.visibilityDescription}>
                                Anyone can join instantly without approval
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.visibilityOption,
                            visibility === 'invite_only' && styles.visibilityOptionSelected
                        ]}
                        onPress={() => setVisibility('invite_only')}
                    >
                        <View style={styles.radioOuter}>
                            {visibility === 'invite_only' && <View style={styles.radioInner} />}
                        </View>
                        <View style={styles.visibilityContent}>
                            <View style={styles.visibilityHeader}>
                                <Text style={styles.visibilityIcon}>🔒</Text>
                                <Text style={styles.visibilityTitle}>Invite-Only</Text>
                            </View>
                            <Text style={styles.visibilityDescription}>
                                Users can request to join. You approve or reject requests.
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Closed option removed - can only be set after creation via edit */}
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    style={[styles.createButton, creating && styles.disabledButton]}
                    onPress={handleCreate}
                    disabled={creating}
                >
                    {creating ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.createButtonText}>Create Community</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    backButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    headerSpacer: {
        width: 60,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
        backgroundColor: 'white',
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#F9F9F9',
    },
    textArea: {
        height: 100,
        paddingTop: 12,
        textAlignVertical: 'top',
    },
    helperText: {
        fontSize: 12,
        color: '#999',
        marginTop: 6,
    },
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    badgeOption: {
        width: 56,
        height: 56,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    badgeOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    badgeText: {
        fontSize: 32,
    },
    visibilityOption: {
        flexDirection: 'row',
        padding: 16,
        borderWidth: 2,
        borderColor: '#DDD',
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: 'white',
    },
    visibilityOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
    },
    visibilityContent: {
        flex: 1,
    },
    visibilityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    visibilityIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    visibilityTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    visibilityDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    createButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#CCC',
        opacity: 0.6,
    },
});
