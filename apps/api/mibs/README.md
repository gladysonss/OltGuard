# MIBs

Arquivos MIB usados para gerar os OIDs de monitoramento (SNMP) e mapear as traps por fabricante de OLT.

## Organização

Um subdiretório por fabricante:

```
mibs/
├── parks/
│   └── *.mib
├── huawei/     # pós-MVP
└── zte/        # pós-MVP
```

## Convenção

- Manter os arquivos `.mib` originais sem alteração (referência de origem).
- Qualquer mapeamento derivado (OID → evento interno) vai em código (`apps/api/src/olt/`), não neste diretório — aqui fica só a fonte.
