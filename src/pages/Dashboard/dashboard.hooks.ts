import { RootState, AppDispatch } from "../../store";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthForm } from "../Auth/auth.hooks";
import { useDispatch, useSelector } from 'react-redux';
import {
    Settings,
    Shield,
    Key,
    AlertTriangle,
    Crown,
    Database,
    School2Icon
} from "lucide-react";
import {
    nextStep,
    prevStep,
    goToStep,
    resetCreation,
    updateField as handleUpdateField,
    toggleModule as handleToggleModule,
    togglePlatform as handleTogglePlatform,
    toggleOffice as handleToggleOffice,
    addRole as handleAddRole,
    updateRole as handleUpdateRole,
    removeRole as handleRemoveRole,
    addUserToRole as handleAddUserToRole,
    updateUserInRole as handleUpdateUserInRole,
    removeUserFromRole as handleRemoveUserFromRole,
} from '../../features/UMS/UMSCreationSlice'; // Adjust the path to your slice file
import { errorTypeAPI, PermissionsData, Role, RoleUser, UMS, UMSForm } from "../../interfaces/types";
import api from "../../config/axios";
import { toast } from "react-toastify";
import {
    fetchAllUMS,
    createUMS,
    updateUMS,
    deleteUMS,
    setCurrentUMS,
    clearError,
    fetchUMSById
} from '../../features/UMS/UMSManagementSlice';
import { useNavigate, useParams } from "react-router";
import UserInterface from "../../interfaces/user.interface";

export const useUMSSettings = () => {
    const { id } = useParams<{ id: string }>();
    const { fetchUMS, ums } = useUMSDetail();

    const [activeTab, setActiveTab] = useState('general');
    const [showPassword, setShowPassword] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [savingError, setSavingError] = useState<string | null>(null);
    const [formData, setFormData] = useState<UMSForm>({});

    const dispatch = useDispatch();
    const currentUMS = useSelector((state: RootState) => state.umsManagement.currentUMS);

    // Fetch from backend only once and update global state
    useEffect(() => {
        if (id && !currentUMS) {
            fetchUMS(id);
        }
    }, [fetchUMS, id, currentUMS]);

    // Update global state when we get data from backend
    useEffect(() => {
        if (ums && (!currentUMS || currentUMS.id !== ums.id)) {
            dispatch(setCurrentUMS(ums));
        }
    }, [dispatch, ums, currentUMS]);

    // Initialize form data from global state
    useEffect(() => {
        if (currentUMS) {
            setFormData({
                umsLogo: currentUMS.umsLogoUrl || '',
                umsPhoto: currentUMS.umsPhotoUrl || '',
                umsName: currentUMS.umsName || '',
                umsTagline: currentUMS.umsTagline || '',
                umsDescription: currentUMS.umsDescription || '',
                umsWebsite: currentUMS.umsWebsite || '',
                umsSize: currentUMS.umsSize || '',
                umsType: currentUMS.umsType || undefined,
                adminName: currentUMS.adminName || '',
                adminEmail: currentUMS.adminEmail || '',
                adminPhone: currentUMS.adminPhone || '',
                enable2FA: currentUMS.enable2FA || false,
                // defaultPassword: 'password123', // This would come from API
                modules: currentUMS.modules || [],
                platforms: currentUMS.platforms || {},
                roles: currentUMS.roles || [],
                departments: currentUMS.departments || []
            });
        }
    }, [currentUMS]);

    const handleInputChange = <K extends keyof UMSForm>(field: K, value: UMSForm[K]) => {
        console.log("in handle Input in Hooks", { field, value })
        setFormData(prev => ({ ...prev, [field]: value }));
        dispatch(handleUpdateField({ field, value }))
        console.log("formdata in hooks", formData)
        setUnsavedChanges(true);
    };

    // const updateField = <K extends keyof UMSForm>(field: K, value: UMSForm[K]) => {
    //     console.log("field", {field, value})
    //     dispatch(handleUpdateField({ field, value }));
    // };

    // Fix 4: Add role-specific update functions that also update global state
    const updateFormDataRoles = (newRoles: Role[]) => {
        setFormData(prev => ({ ...prev, roles: newRoles }));
        setUnsavedChanges(true);

        // Also update global state to keep it in sync
        if (currentUMS) {
            dispatch(setCurrentUMS({ ...currentUMS, roles: newRoles }));
        }
    };

    const getFormDataForUpdate = (currentData: any, originalData: any) => {
        const payload = new FormData();
        let hasChanges = false;

        // Iterate over the current form data
        for (const key in currentData) {
            // Skip keys that are not part of the update payload (e.g., internal component state)
            if (key === 'id' || key === '_id') {
                continue;
            }

            const currentValue = currentData[key];
            const originalValue = originalData[key];

            // --- Logic to detect changes ---
            if (
                // Always include files, as they are considered new changes
                currentValue instanceof File ||
                // Check for a change in value for primitive types
                (typeof currentValue !== 'object' && currentValue !== originalValue) ||
                // Check for changes in objects and arrays by stringifying them
                (typeof currentValue === 'object' && JSON.stringify(currentValue) !== JSON.stringify(originalValue))
            ) {
                hasChanges = true;
                // Append the changed field to the FormData payload
                if (currentValue instanceof File) {
                    payload.append(key, currentValue);
                } else if (typeof currentValue === 'object') {
                    payload.append(key, JSON.stringify(currentValue));
                } else {
                    payload.append(key, currentValue);
                }
            }
        }

        return hasChanges ? payload : null;
    };


    const handleSave = async () => {
        // --- 1. Guard against unnecessary or duplicate calls ---
        if (!unsavedChanges || isUpdating || !currentUMS) {
            return;
        }

        // --- 2. Manage loading and error states ---
        setIsUpdating(true);
        setSavingError(null);

        try {
            // --- 3. Get the payload with only the changed fields ---
            const payload = getFormDataForUpdate(formData, currentUMS);

            // If there are no actual changes, exit early
            if (!payload) {
                console.log('No changes detected. Skipping API call.');
                toast.info('No changes to save.', { autoClose: 2000 });
                setUnsavedChanges(false);
                return;
            }

            // --- 4. Make the API call to your backend's PATCH endpoint ---
            const response = await api.patch(`/ums/${currentUMS.id}`, payload, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // --- 5. Handle a successful response ---
            const updatedUms = response.data;
            console.log('Successfully saved changes:', updatedUms);
            dispatch(setCurrentUMS(updatedUms));
            setUnsavedChanges(false);
            toast.success('Changes saved successfully!', { autoClose: 2000 });

        } catch (err) {
            console.error('Failed to save changes:', err);
            const deError = err
            console.log(deError)
            const errorMessage = deError.response?.data?.message.message || 'An unexpected error occurred.';
            setSavingError(errorMessage);
            toast.error('Changes not saved', { autoClose: 2000 });
        } finally {
            setIsUpdating(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'admin', label: 'Admin', icon: Crown },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'roles', label: 'Roles & Permissions', icon: Key },
        { id: 'departments', label: 'Departments', icon: School2Icon },
        { id: 'modules', label: 'Modules & Platforms', icon: Database },
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle }
    ];

    return {
        id,
        activeTab,
        setActiveTab,
        showPassword,
        setShowPassword,
        unsavedChanges,
        isUpdating,
        savingError,
        setUnsavedChanges,
        formData,
        setFormData,
        updateFormDataRoles, // Fix 5: Add this helper function
        tabs,
        handleInputChange,
        handleSave,
        currentUMS // Fix 6: Expose currentUMS for other components
    }
}


export const useUMSDetail = () => {
    const dispatch = useDispatch<AppDispatch>();

    const ums = useSelector((state: RootState) => state.umsManagement.currentUMS);
    const isLoading = useSelector((state: RootState) => state.umsManagement.loading);
    const error = useSelector((state: RootState) => state.umsManagement.error);

    const fetchUMS = useCallback((id: string) => {
        dispatch(fetchUMSById(id));
    }, [dispatch]);

    return { ums, isLoading, error, fetchUMS };
};

export const useUMSManagement = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { umsList, loading, error, currentUMS } = useSelector((state: RootState) => state.umsManagement);
    const navigate = useNavigate();

    const fetchUMSs = useCallback(() => {
        dispatch(fetchAllUMS());
    }, [dispatch]);


    useEffect(() => {
        fetchUMSs();
    }, [fetchUMSs]);
    const addUMS = (newUMS: Omit<UMS, 'id'>) => dispatch(createUMS(newUMS));
    const modifyUMS = (id: string, data: Partial<UMS>) => dispatch(updateUMS({ id, data }));
    const removeUMS = (id: string) => dispatch(deleteUMS(id));
    const selectUMS = (ums: UMS | null) => dispatch(setCurrentUMS(ums));
    const resetError = () => dispatch(clearError());

    const handleAction = (action: 'view' | 'delete', umsId: string) => {
        const ums = umsList.find((u) => u.id === umsId);
        if (!ums) return;
        if (action === 'view') {
            navigate(`/dashboard/ums/${umsId}`);
            setCurrentUMS(ums);
        }
        if (action === 'delete') {
            const confirmed = window.confirm(`Are you sure you want to terminate "${ums.umsName}"?`);
            if (confirmed) deleteUMS(umsId);
        }
    };
    return {
        umsList,
        currentUMS,
        isLoading: loading,
        error,
        fetchUMSs,
        handleAction,
        createUMS: addUMS,
        updateUMS: modifyUMS,
        deleteUMS: removeUMS,
        setCurrentUMS: selectUMS,
        clearError: resetError,
    };
};


export const usePermissions = () => {
    const [permissions, setPermissions] = useState<PermissionsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getPermissions = async () => {
        try {
            setLoading(true);
            const response = await api.get('/permissions/grouped');

            // Assuming the response.data matches the PermissionsData structure
            setPermissions(response.data || null);
            // console.log('Permissions loaded:', response.data);
            setError(null);
        } catch (err: unknown) {
            console.error('Error fetching permissions:', err);

            // Type-safe error handling
            if (
                err &&
                typeof err === 'object' &&
                'response' in err &&
                err.response &&
                typeof err.response === 'object' &&
                'data' in err.response &&
                err.response.data &&
                typeof err.response.data === 'object' &&
                'message' in err.response.data
            ) {
                setError((err.response.data as { message?: string }).message || 'Failed to load permissions');
            } else {
                setError('Failed to load permissions');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getPermissions();
    }, []);

    // Helper functions to work with permissions
    const hasPermission = (module: keyof PermissionsData, permissionName: string): boolean => {
        if (!permissions) return false;
        return permissions[module].some(permission => permission.name === permissionName);
    };

    const getPermissionsByModule = (module: keyof PermissionsData) => {
        return permissions?.[module] || [];
    };

    const getAllPermissions = () => {
        if (!permissions) return [];

        return Object.values(permissions).flat();
    };

    return {
        permissions,
        loading,
        error,
        refetch: getPermissions,
        hasPermission,
        getPermissionsByModule,
        getAllPermissions
    };
};


export const useCreateUMS = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentStep, formData } = useSelector((state: RootState) => state.umsCreation);
    const [isLaunching, setIsLaunching] = useState(false);

    // Generic field updater
    const updateField = <K extends keyof UMSForm>(field: K, value: UMSForm[K]) => {
        dispatch(handleUpdateField({ field, value }));
    };

    // Module toggler
    const toggleModule = (mod: string) => {
        dispatch(handleToggleModule(mod));
    };

    // Office toggler
    const toggleOffice = (office: string) => {
        dispatch(handleToggleOffice(office));
    };

    // Platform toggler
    const togglePlatform = (platform: "teacherApp" | "studentApp") => {
        dispatch(handleTogglePlatform(platform));
    };

    // Role methods
    const addRole = (role: Partial<Role> = { name: "", users: [] }) => {
        dispatch(handleAddRole(role));
    };

    const updateRole = (index: number, updatedRole: Partial<Role>) => {
        console.log("Updating role at index:", index, "with data:", updatedRole);
        dispatch(handleUpdateRole({ index, role: updatedRole }));
    };

    const removeRole = (index: number) => {
        dispatch(handleRemoveRole(index));
    };

    // Role user methods
    const addUserToRole = (roleIndex: number, user: RoleUser) => {
        dispatch(handleAddUserToRole({ roleIndex, user }));
    };

    const updateUserInRole = (roleIndex: number, userIndex: number, user: Partial<RoleUser>) => {
        dispatch(handleUpdateUserInRole({ roleIndex, userIndex, user }));
    };

    const removeUserFromRole = (roleIndex: number, userIndex: number) => {
        dispatch(handleRemoveUserFromRole({ roleIndex, userIndex }));
    };

    // Submit the UMS
    const submitUMS = async (form: UMSForm) => {

        if (!form.umsName || !form.adminName || !form.adminEmail) {
            toast.error("Please fill in all required fields");
            return;
        }
        try {
            setIsLaunching(true);
            // Prepare form data for submission
            const formData = new FormData();

            // Utility to convert a URL (dataURL/object URL) to a File
            const urlToFile = async (url: string, fileName: string): Promise<File> => {
                const res = await fetch(url);
                const blob = await res.blob();
                return new File([blob], fileName, { type: blob.type });
            };

            // First, transform the array of 'Role' objects to the 'RoleToBack' type
            const rolesToBack = form.roles.map(role => {
                // For each role, extract just the 'id' from the permissions array
                const permissionIds = role.permissions.map(permission => permission.id);

                // Return a new object that matches the 'RoleToBack' structure
                return {
                    name: role.name,
                    description: role.description,
                    permissionIds: permissionIds,
                    users: role.users,
                };
            });
            // Append logo image
            if (form.umsLogo) {
                const logoFile = await urlToFile(form.umsLogo, "ums-logo.png");
                console.log(logoFile);
                formData.append("umsLogo", logoFile);
                console.log("umsLogo", logoFile)
            }

            // Append photo image
            if (form.umsPhoto) {
                const photoFile = await urlToFile(form.umsPhoto, "ums-photo.png");
                formData.append("umsPhoto", photoFile);
                console.log("umsPhoto", photoFile)
            }

            // Append primitive fields
            formData.append("umsName", form.umsName);
            formData.append("umsDescription", form.umsDescription);
            if (form.umsTagline) formData.append("umsTagline", form.umsTagline);
            if (form.umsWebsite) formData.append("umsWebsite", form.umsWebsite);
            if (form.umsType) formData.append("umsType", form.umsType);
            if (form.umsSize) formData.append("umsSize", form.umsSize);

            formData.append("adminName", form.adminName);
            formData.append("adminEmail", form.adminEmail);
            if (form.adminPhone) formData.append("adminPhone", form.adminPhone);
            formData.append("enable2FA", String(form.enable2FA ?? false));

            // Append arrays/objects as JSON strings
            formData.append("roles", JSON.stringify(rolesToBack));
            formData.append("modules", JSON.stringify(form.modules));
            formData.append("platforms", JSON.stringify(form.platforms));

            // Submit to backend
            const response = await api.post('ums', formData);
            //  = await fetch("/api/ums", {
            //     method: "POST",
            //     body: formData,
            // });

            if (response.status < 200 || response.status >= 300) {
                throw new Error("UMS submission failed");
            }

            setIsLaunching(false);
            // Toast proper feed back
            navigate("/dashboard/ums")
            toast.success("UMS submitted successfully");
            return response.data;
        } catch (error) {
            // Toast proper feedback
            toast.error("UMS submission failed");
            console.error("UMS submission error:", error);
            throw error;
        }
    };


    // Navigation
    const next = () => dispatch(nextStep());
    const back = () => dispatch(prevStep());
    const reset = () => dispatch(resetCreation());
    const goToTheStep = (step: number) => dispatch(goToStep(step));

    return {
        step: currentStep,
        form: formData,
        updateField,
        toggleModule,
        toggleOffice,
        togglePlatform,
        addRole,
        updateRole,
        removeRole,
        addUserToRole,
        updateUserInRole,
        removeUserFromRole,
        submitUMS,
        isLaunching,
        // Navigation methods
        next,
        back,
        reset,
        goToTheStep
    };
};


/**
 * Manages dashboard layout state, including user session and dropdown menu.
 * 
 * @returns an object containing user loading state, authentication data, 
 *          dropdown visibility controls, and logout handler.
 */
const useDashboardLayout = () => {
    // Grab user from Redux. undefined => still loading; null => not authenticated; object => authenticated
    const userFromStore = useSelector((state: RootState) => state.auth.user);

    // Local state to distinguish loading vs loaded/null
    const [user, setUser] = useState<UserInterface | null | undefined>(undefined);

    const [minLoadingTime, setMinLoadingTime] = useState(true);
    // Dropdown visibility
    const [showMenu, setShowMenu] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Logout handler from custom auth hook
    const { handleLogout } = useAuthForm({ intent: 'signup' });

    // Sync local user state with Redux store
    useEffect(() => {
        setUser(userFromStore);
    }, [userFromStore]);


    useEffect(() => {
        const timer = setTimeout(() => setMinLoadingTime(false), 1000); // 500ms minimum
        return () => clearTimeout(timer);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownRef]);

    // Loading indicator: still checking auth status
    const isLoading = user === undefined || minLoadingTime;

    return {
        user,             // User object or null if not signed in
        isLoading,        // true while auth status is being determined
        showMenu,         // dropdown open/closed
        setShowMenu,      // toggle handler
        dropdownRef,      // ref for click-outside detection
        handleLogout      // method to sign the user out
    };
};


export default useDashboardLayout;