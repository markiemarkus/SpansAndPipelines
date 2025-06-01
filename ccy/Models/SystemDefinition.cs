using System.Collections.ObjectModel;

namespace CurrencyManager.Models
{
    public class SystemDefinition
    {
        public string Name { get; set; }
        public ObservableCollection<TierMappingItem> CurrencyTierMap { get; set; }

        public SystemDefinition(string name)
        {
            Name = name;
            CurrencyTierMap = new ObservableCollection<TierMappingItem>();
        }
    }
} 