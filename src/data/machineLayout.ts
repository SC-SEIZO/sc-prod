// Canonical machine layout for all plants (single source of truth).
// Used by the Login page (member machine selector), Production page
// (Machine FUKA Control) and the Production Board.
export interface MachineDef {
  id: string;
  tonnage: string;
}

export interface FactoryDef {
  name: string;
  label: string;
  machines: MachineDef[];
}

export interface PlantDef {
  plant: string;
  factories: FactoryDef[];
}

export const PLANT_LAYOUT: PlantDef[] = [
  {
    plant: 'SC1 (Cibitung)',
    factories: [
      {
        name: 'FACT 2',
        label: 'SC1 - Factory 2 (Cibitung)',
        machines: [
          { id: 'MC 1', tonnage: '2500T' },
          { id: 'MC 2', tonnage: '3500T' },
          { id: 'MC 3', tonnage: '3500T' },
          { id: 'MC 4', tonnage: '2500T' },
          { id: 'MC 5', tonnage: '3500T' },
          { id: 'MC 6', tonnage: '2500T' },
          { id: 'MC 7', tonnage: '2500T' },
          { id: 'MC 8', tonnage: '2500T' }
        ]
      },
      {
        name: 'FACT 3',
        label: 'SC1 - Factory 3 (Cibitung)',
        machines: [
          { id: 'MC 1', tonnage: '1300T' },
          { id: 'MC 2', tonnage: '1300T' },
          { id: 'MC 3', tonnage: '1300T' },
          { id: 'MC 4', tonnage: '1050T' },
          { id: 'MC 5', tonnage: '2500T' },
          { id: 'MC 6', tonnage: '1600T' },
          { id: 'MC 7', tonnage: '2500T' },
          { id: 'MC 8', tonnage: '2500T' },
          { id: 'MC 9', tonnage: '1600T' },
          { id: 'MC 10', tonnage: '1600T' },
          { id: 'MC 10B', tonnage: '1600T' },
          { id: 'MC 11', tonnage: '650T' },
          { id: 'MC 13', tonnage: '650T' },
          { id: 'MC 14', tonnage: '650T' }
        ]
      },
      {
        name: 'FACT 4',
        label: 'SC1 - Factory 4 (Cibitung)',
        machines: [
          { id: 'MC 1', tonnage: '2500T' },
          { id: 'MC 7', tonnage: '2500T' },
          { id: 'MC 8', tonnage: '2500T' },
          { id: 'MC B1', tonnage: '3500T' },
          { id: 'MC B2', tonnage: '3500T' },
          { id: 'MC B3', tonnage: '3500T' }
        ]
      }
    ]
  },
  {
    plant: 'SC2 (Karawang)',
    factories: [
      {
        name: 'SC2 Resin',
        label: 'SC2 - Karawang Plant',
        machines: [
          { id: 'MC 1', tonnage: '2500T' },
          { id: 'MC 2', tonnage: '3500T' },
          { id: 'MC 3', tonnage: '3500T' },
          { id: 'MC 4', tonnage: '3500T' },
          { id: 'MC 5', tonnage: '3500T' }
        ]
      }
    ]
  }
];

// Flat list of factories with their labels (login machine selector)
export const FACTORY_LIST: FactoryDef[] = PLANT_LAYOUT.flatMap(p => p.factories);
