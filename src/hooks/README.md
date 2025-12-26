# Hooks Personalizados

Esta carpeta contiene hooks personalizados reutilizables para el proyecto Timeboxing.

## useFormState

Hook para manejar estados de formularios con validación y manejo de errores.

```typescript
import { useFormState } from '@/hooks/useFormState';

const { formData, errors, updateField, handleSubmit } = useFormState({
  name: '',
  email: '',
});

// Actualizar campo
updateField('name', 'Nuevo nombre');

// Enviar formulario
await handleSubmit(async (data) => {
  await saveData(data);
}, 'FormContext');
```

## useAsyncOperation

Hook para manejar operaciones asíncronas con estados de carga y error.

```typescript
import { useAsyncOperation } from '@/hooks/useAsyncOperation';

const { execute, isLoading, error } = useAsyncOperation(
  async (id: string) => {
    return await fetchData(id);
  },
  {
    onSuccess: () => toast.success('Completado'),
    context: 'FetchData'
  }
);

// Ejecutar
await execute('123');
```

## useDebounce

Hook para debouncear valores (útil para búsquedas, auto-guardado).

```typescript
import { useDebounce } from '@/hooks/useDebounce';

const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500);

useEffect(() => {
  // Buscar solo después de 500ms sin cambios
  performSearch(debouncedSearch);
}, [debouncedSearch]);
```

## useFormValidation

Hook para validar formularios con Zod.

```typescript
import { useFormValidation } from '@/hooks/useFormValidation';
import { projectSchema } from '@/schemas/projectSchema';

const { validate, validateField } = useFormValidation(projectSchema);

// Validar todo el formulario
const { isValid, errors } = validate(formData);

// Validar un campo específico
const error = validateField('name', formData.name);
```

