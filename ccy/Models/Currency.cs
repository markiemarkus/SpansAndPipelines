using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace CurrencyManager.Models
{
    public class TierMappingItem : INotifyPropertyChanged
    {
        private string _code;
        private string _name;
        private int _tier;

        public string Code
        {
            get => _code;
            set
            {
                _code = value;
                OnPropertyChanged();
            }
        }

        public string Name
        {
            get => _name;
            set
            {
                _name = value;
                OnPropertyChanged();
            }
        }

        public int Tier
        {
            get => _tier;
            set
            {
                if (value < 1 || value > 4)
                    throw new ArgumentException("Tier must be between 1 and 4", nameof(value));
                
                _tier = value;
                OnPropertyChanged();
            }
        }

        public TierMappingItem(string code, string name, int tier)
        {
            if (tier < 1 || tier > 4)
                throw new ArgumentException("Tier must be between 1 and 4", nameof(tier));

            _code = code;
            _name = name;
            _tier = tier;
        }

        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
} 